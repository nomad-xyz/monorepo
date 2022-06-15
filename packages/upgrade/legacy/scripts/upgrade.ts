#!/usr/bin/env ts-node

import * as config from "@nomad-xyz/configuration";
import * as ethers from "ethers";
import { NonceManager } from "@ethersproject/experimental";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import { Command, Flags } from "@oclif/core";
export class upgradeCLI extends Command {
  static flags = {
    // can pass either --force or -f
    resume: Flags.boolean({ char: "r" }),
    test: Flags.boolean({ char: "t" }),
    config: Flags.string({
      required: false,
      char: "c",
    }),
    domains: Flags.string({
      char: "d",
      multiple: true,
      exclusive: ["all"],
    }),
    all: Flags.boolean({ char: "a" }),
    help: Flags.help(),
    version: Flags.version(),
  };
  static args = [{ name: "command" }];

  static config = {
    name: "Nomad Upgrade",
    version: "0.0.1",
  };

  nomadConfig: config.NomadConfig;
  newNomadConfig: config.NomadConfig;

  async run() {
    dotenv.config();
    const { flags } = await this.parse(upgradeCLI);
    const { args } = await this.parse(upgradeCLI);

    this.nomadConfig = this.getConfigFromPath(flags.config);
    this.newNomadConfig = this.getConfigFromPath(flags.config);
    const networks = this.nomadConfig.networks;

    this.announce("Welcome to Nomgrade");

    // If test, then replace rpc endpoints with local ones
    if (flags.test) {
      this.announce("Upgrade script will run in test mode");
      console.log(
        "It expects to find local EVM-compatible RPC endpoints, that listen on an incrementing port number, starting at 8545"
      );
      console.log(
        "Use multi-anvil.sh to quickly spin up multiple anvil instances with incrementing port number"
      );
      this.announce("RPC endpoints");
      for (let index in networks) {
        let port: number = 8545 + parseInt(index);
        this.nomadConfig.rpcs[networks[index]][0] = `http://127.0.0.1:${port}`;
      }
    }
    console.log("The following RPC endpoints will be used");
    console.log(this.nomadConfig.rpcs);
    let domains;
    if (flags.all) {
      domains = this.nomadConfig.networks;
    } else {
      domains = flags.domains;
    }
    for (const domainName of domains) {
      if (args.command == "upgrade") {
        this.upgrade(domainName, flags.resume);
      } else if (args.command == "executeCallBatch") {
        this.executeCallBatch(domainName);
      } else if (args.command == "forkTest") {
        this.upgradeForkTest(domainName);
      } else if (args.command == "printGovActions") {
        if (domains.length != 1) {
          throw new Error(
            `You can execute govActions only the Governor Chain, thus you need to pass exactly a single domain. You passed: ${domains}}`
          );
        }
        const govChain = domains[0];
        this.printGovActions(govChain);
      } else {
        console.log(`command ${args.command} is not recognised`);
        console.log(
          "use on of: upgrade, executeCallbatch, forkTest, printGovActions"
        );
      }
    }
  }
  async executeCallBatch(domainName: any) {
    const config = this.nomadConfig;
    const rpc = config.rpcs[domainName][0];
    const path = `./upgrade-artifacts/${domainName}/artifacts.json`;
    const privateKey =
      process.env.PRIVATE_KEY ||
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    try {
      // try loading as a local filepath
      const artifacts = JSON.parse(fs.readFileSync(path).toString());
      if (artifacts.executeCallBatch.length == 0) {
        throw new Error(
          `batchCallData artifact is empty for domain ${domainName}. Run the upgrade script or manually create an artifacts.json file with the required fields`
        );
      }
      process.env["NOMAD_CALL_BATCH"] = artifacts.batch;
      process.env["NOMAD_GOV_ROUTER"] =
        config.core[domainName].governanceRouter.proxy;
    } catch (e) {
      throw e;
    }
    const command = this.forgeScriptCommand(
      domainName,
      "executeCallBatchCall(string)",
      `${domainName}`,
      "../../solscripts/Upgrade.sol",
      "UpgradeActions",
      rpc,
      privateKey,
      false,
      true
    );
    this.executeCommand(domainName, command, "executeCallBatch-output");
  }

  async printGovActions(domainName: any) {
    // Hardcoded, should change
    const govChain = domainName;
    const config = this.nomadConfig;
    const rpc = config.rpcs[govChain][0];
    let remoteBatches: string[] = [];
    let remoteDomains: number[] = [];
    let localBatch: string = "";
    for (const domainName of config.networks) {
      try {
        const path = `./upgrade-artifacts/${domainName}/artifacts.json`;
        const artifacts = JSON.parse(fs.readFileSync(path).toString());
        if (artifacts.callBatch.length == 0) {
          throw new Error(
            `batchCallData artifact is empty for domain ${domainName}. Run the upgrade script or manually create an artifacts.json file with the required fields`
          );
        }
        if (domainName != govChain) {
          remoteBatches.push(artifacts.callBatch);
          remoteDomains.push(config.protocol.networks[domainName].domain);
        } else {
          localBatch = artifacts.callBatch;
        }
      } catch (e) {
        throw e;
      }
    }
    // Forge can read arrays, but they need to consist of the values, seperated by the delimeter
    // without any quotes, spaces or brackets.
    process.env["NOMAD_REMOTE_CALL_BATCHES"] = JSON.stringify(remoteBatches)
      .replace(/]|[[]/g, "")
      .replace(/['"]+/g, "")
      .replace(/['"]+/g, "");
    process.env["NOMAD_REMOTE_DOMAINS"] = JSON.stringify(remoteDomains)
      .replace(/]|[[]/g, "")
      .replace(/['"]+/g, "")
      .replace(/['"]+/g, "");
    process.env["NOMAD_LOCAL_CALL_BATCH"] = localBatch;
    process.env["NOMAD_GOV_ROUTER"] =
      config.core[govChain].governanceRouter.proxy;
    const command = this.forgeScriptCommand(
      govChain,
      "printGovernanceActions()",
      "",
      "../../solscripts/Upgrade.sol",
      "UpgradeActions",
      "",
      "",
      false,
      false
    );
    this.executeCommand(govChain, command, "executeGovActions-output");
  }
  async upgrade(domainName: string, resume: boolean) {
    const config = this.nomadConfig;
    const networks = config.networks;
    const rpcs = config.rpcs;

    const networkConfig = config.protocol.networks[domainName];

    // Arguments for upgrade script's function signature
    const domain: number = networkConfig.domain;

    this.setUpgradeEnv(domainName);

    // flag arguments for forge script
    const rpc = rpcs[domainName][0];
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey.length == 0) {
      throw new Error(
        "Mising private key in .env. Please set the PRIVATE_KEY variable and run again"
      );
    }

    // Create directory for upgrade artifacts
    fs.mkdir(
      `./upgrade-artifacts/${domainName}`,
      { recursive: true },
      (err) => {
        if (err) throw err;
      }
    );
    // forge script command with all the arguments, ready to be executed
    const command: string = this.forgeScriptCommand(
      domainName,
      "upgrade(uint32, string)",
      `${domain} ${domainName}`,
      "../../solscripts/Upgrade.sol",
      "Upgrade",
      rpc,
      privateKey,
      resume,
      true
    );

    this.executeCommand(domainName, command, "upgrade-output");
  }

  setUpgradeEnv(domainName: string): void {
    const config = this.nomadConfig;
    const networks = config.networks;
    const rpcs = config.rpcs;
    const timelock =
      config.protocol.networks[domainName].configuration.governance
        .recoveryTimelock;

    // Beacons for Core contracts
    const homeBeacon = config.core[domainName].home.beacon;
    const governanceRouterBeacon =
      config.core[domainName].governanceRouter.beacon;

    // Beacons for Bridge contracts
    const bridgeRouterBeacon = config.bridge[domainName].bridgeRouter.beacon;
    const tokenRegistryBeacon = config.bridge[domainName].tokenRegistry.beacon;
    const bridgeTokenBeacon = config.bridge[domainName].bridgeToken.beacon;
    // Get first replica beacon.
    // All replicas in every domain, share the same beacon, as they share the same implementation
    // but have different proxies, because they have different storage.
    const replicaBeacon =
      config.core[domainName].replicas[
        Object.keys(config.core[domainName].replicas)[0]
      ].beacon;

    // UpgradeBeaconController and Governance Router
    const upgradeBeaconController =
      config.core[domainName].upgradeBeaconController;

    // Set env variables to be picked up by forge script
    // Set beacon addresses
    process.env["NOMAD_HOME_BEACON"] = homeBeacon;
    process.env["NOMAD_GOVERNANCE_ROUTER_BEACON"] = governanceRouterBeacon;
    process.env["NOMAD_BRIDGE_ROUTER_BEACON"] = bridgeRouterBeacon;
    process.env["NOMAD_TOKEN_REGISTRY_BEACON"] = tokenRegistryBeacon;
    process.env["NOMAD_BRIDGE_ROUTER_BEACON"] = bridgeTokenBeacon;
    process.env["NOMAD_REPLICA_BEACON"] = replicaBeacon;
    // set env variable for timelock
    process.env["NOMAD_RECOVERY_TIMELOCK"] = timelock.toString();
    process.env["NOMAD_BEACON_CONTROLLER"] = upgradeBeaconController;
  }

  upgradeForkTest(domainName: string): void {
    console.log("Starting Fork test...");
    console.log(
      "Results and output will be printed after the fork test is complete"
    );
    // Get first replica beacon.
    // All replicas in every domain, share the same beacon, as they share the same implementation
    // but have different proxies, because they have different storage.
    const config = this.nomadConfig;
    const rpc = process.env.RPC_URL || config.rpcs[domainName][0];
    const replicaProxy =
      config.core[domainName].replicas[
        Object.keys(config.core[domainName].replicas)[0]
      ].proxy;

    const governanceRouterProxy =
      config.core[domainName].governanceRouter.proxy;

    // Set env variables required by Fork test and Upgrade
    process.env["NOMAD_REPLICA_PROXY"] = replicaProxy;
    process.env["NOMAD_GOV_ROUTER_PROXY"] = governanceRouterProxy;
    process.env["NOMAD_DOMAIN_NAME"] = domainName;
    process.env["NOMAD_DOMAIN"] =
      config.protocol.networks[domainName].domain.toString();
    this.setUpgradeEnv(domainName);

    const command: string = `FOUNDRY_PROFILE=upgrade forge test --ffi --silent --fork-url ${rpc} -vvvv`;
    this.executeCommand(domainName, command, "forktest-output");
  }

  executeCommand(domainName: string, command: string, outputFile: string) {
    // Execute forge script
    exec(command, (error, stdout, stderr) => {
      // Print output of forge script
      console.log(stdout);
      // Save output to a file, for posterity
      if (stderr) {
        console.log(stderr);
      }
      fs.writeFile(
        `./upgrade-artifacts/${domainName}/${outputFile}.txt`,
        stdout,
        function (err) {
          if (err) {
            return console.log(
              `Failed to write upgrade artifact with Error: ${err}`
            );
          }
        }
      );
      // If forge script upgrades the protocol, extract the new implementation addresses
      // from the output and createa an updated protocol config file
      if (command.includes("--sig upgrade")) {
        const config = this.extractImplementations(domainName, stdout);
        // This should change to be generated at the same directory
        // as the config
        fs.writeFile(
          "./new-config.json",
          JSON.stringify(config),
          function (err) {
            if (err) {
              return console.log(
                `Failed to write upgrade artifact with Error: ${err}`
              );
            }
          }
        );
      }
      // If upgrade or printGovActions, then extract Artifacts
      // They are different artifacts that live in the same JSON file
      if (
        command.includes("--sig upgrade") ||
        command.includes("-- printGovActions")
      ) {
        // Extract specific artifacts from raw output and store them in a JSON file
        const path = `./upgrade-artifacts/${domainName}/artifacts.json`;
        let newArtifacts = this.extractArtifacts(stdout, domainName);
        try {
          const existing: artifacts = JSON.parse(
            fs.readFileSync(path).toString()
          );
          console.log("Found existing artifacts, appending..");
          Object.keys(existing).forEach((key) => {
            // From the newArtifacts, keep only the non-empty
            // fields
            if (newArtifacts[key as keyof artifacts] != "") {
              existing[key as keyof artifacts] =
                newArtifacts[key as keyof artifacts];
            }
          });
          newArtifacts = existing;
        } catch (error) {
          console.log("No artifacts.json file found. Creating new..");
        }
        fs.writeFileSync(path, JSON.stringify(newArtifacts));
        console.log(`Artifacts were written to ${path}`);
      }
    });
  }

  forgeScriptCommand(
    domainName: string,
    commandSignature: string,
    args: string,
    pathToFile: string,
    targetContract: string,
    rpcUrl: string,
    privateKey: string,
    resume: boolean,
    broadcast: boolean
  ): string {
    let resumeOrBroadcast;
    if (resume) {
      resumeOrBroadcast = "--resume";
    } else if (broadcast) {
      resumeOrBroadcast = "--broadcast";
    } else {
      resumeOrBroadcast = "";
    }
    if (rpcUrl != "") {
      rpcUrl = `--rpc-url ${rpcUrl}`;
    }
    if (privateKey != "") {
      privateKey = `--private-key ${privateKey}`;
    }
    const pieces = [
      "forge clean",
      "&&",
      `cd ./upgrade-artifacts/${domainName}`,
      "&&",
      "FOUNDRY_PROFILE=upgrade forge script",
      `--tc ${targetContract}`,
      `${rpcUrl}`,
      `${resumeOrBroadcast}`,
      `${privateKey}`,
      `--sig '${commandSignature}'`,
      "--slow",
      "--silent",
      `${pathToFile}`,
      `${args}`,
    ];
    return pieces.join(" ");
  }

  getConfigFromPath(path: string) {
    try {
      // try loading as a local filepath
      return JSON.parse(fs.readFileSync(path).toString());
    } catch (e) {
      throw e;
    }
  }

  // Serially go over the output and extract the lines of interest
  //  The solidity script uses special strings to signify that the next line will
  //  consist the artifact of interest
  extractArtifacts(output: string, domainName: string): artifacts {
    const lines = output.split("\n");
    let artifact: artifacts = {
      executeCallBatchCall: "",
      callBatch: "",
      executeGovernanceActions: "",
    };
    lines.forEach((value, index) => {
      // Artifact used by executeCallbatch()
      // Execute the batched calls that have been sent to a Governance Router
      if (value.includes("executeCallBatch-artifact")) {
        artifact.executeCallBatchCall = lines[index + 1].replace(/\s/g, "");
        // Artifact used by executeGovernanceActions()
        // It's abi.encoded calldata to be sent from the Governor Chain
        // to the remote chains via a governance message
      } else if (value.includes("callBatch-artifact")) {
        artifact.callBatch = lines[index + 1].replace(/\s/g, "");
        // Artifact used by executeGovernanceActions()
        // It's a function call encoded with signature and arguments
        // ready to be sent via Nomad Governance to the Governor's chain Governance Router
      } else if (value.includes("executeGovernanceActions-artifact")) {
        artifact.executeGovernanceActions = lines[index + 1].replace(/\s/g, "");
      }
    });
    return artifact;
  }

  // Extract the newly deployed implementation addresses from the upgrade output
  extractImplementations(
    domainName: string,
    output: string
  ): config.NomadConfig {
    const lines = output.split("\n");
    const config = this.newNomadConfig;
    const core = config.core;
    const bridge = config.bridge;
    lines.forEach((value, index) => {
      if (value.includes("implementation address")) {
        let contract: string = value
          .replace(/\s/g, "")
          .split("implementation")[0];
        let address: string = lines[index + 1].replace(/\s/g, "");
        if (contract != "replica") {
          // The contract will either belong to 'core' or 'bridge' objects
          // of the config file
          try {
            core[domainName][contract].implementation = address;
          } catch (e) {
            bridge[domainName][contract].implementation = address;
          }
        } else {
          for (const network of config.networks) {
            // The domain does not have deployed replicas of itself
            // They live only on different domains
            if (network == domainName) {
              continue;
            }
            core[domainName].replicas[network].implementation = address;
          }
        }
      }
    });
    // Move back the changes
    config.core = core;
    config.bridge = bridge;
    return config;
  }

  announce(what: string): void {
    console.log();
    console.log("===================================");
    console.log(what);
    console.log("===================================");
    console.log();
  }
}

interface artifacts {
  executeCallBatchCall: string;
  callBatch: string;
  executeGovernanceActions: string;
}

upgradeCLI.run();
