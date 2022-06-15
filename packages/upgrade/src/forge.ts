import * as fs from "node:fs";
import * as config from "@nomad-xyz/configuration";
import { exec } from "node:child_process";
const util = require("util");
const asyncExec = util.promisify(require("child_process").exec);

export default class Forge {
  nomadConfig: config.NomadConfig;
  domainName: string;

  command: string;

  workingDir: string;

  constructor(
    config: config.NomadConfig,
    domainName: string,
    workingDir: string
  ) {
    this.nomadConfig = config;
    this.domainName = domainName;
    this.workingDir = workingDir;
  }

  public async executeCommand(outputFile: string) {
    // Create directory for upgrade artifacts
    fs.mkdir(
      `${this.workingDir}/${this.domainName}`,
      { recursive: true },
      (err) => {
        if (err) throw err;
      }
    );
    // Execute forge script
    const { stdout, stderr } = await asyncExec(this.command);
    return { stdout, stderr };
  }

  public scriptCommand(
    domainName: string,
    commandSignature: string,
    args: string,
    pathToFile: string,
    targetContract: string,
    rpcUrl: string,
    privateKey: string,
    resume: boolean,
    broadcast: boolean
  ) {
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
      `cd ${this.workingDir}/${domainName}`,
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
    this.command = pieces.join(" ");
  }

  // Extract the newly deployed implementation addresses from the upgrade output
  extractImplementations(output: string): config.NomadConfig {
    const lines = output.split("\n");
    const config = this.nomadConfig;
    const core = config.core;
    const bridge = config.bridge;
    const domainName = this.domainName;
    for (const [index, value] of lines.entries()) {
      if (value.includes("implementation address")) {
        const contractName: string = value
          .replace(/\s/g, "")
          .split("implementation")[0];
        const address: string = lines[index + 1].replace(/\s/g, "");
        if (contractName != "replica") {
          // The contract will either belong to 'core' or 'bridge' objects
          // of the config file
          try {
            const contract: config.Proxy = core[domainName][
              contractName as keyof config.EvmCoreContracts
            ] as config.Proxy;
            contract.implementation = address;
          } catch {
            const contract: config.Proxy = bridge[domainName][
              contractName as keyof config.EvmBridgeContracts
            ] as config.Proxy;
            contract.implementation = address;
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
    }
    // Move back the changes
    config.core = core;
    config.bridge = bridge;
    return config;
  }
}
