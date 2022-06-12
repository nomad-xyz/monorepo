import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import {NonceManager} from '@ethersproject/experimental';
import fs from 'fs';
import * as dotenv from 'dotenv';
import {exec} from 'child_process';
import {Command, Flags} from '@oclif/core'


export class upgradeCLI extends Command {

  static flags = {
    // can pass either --force or -f
    resume: Flags.boolean({char: 'r'}),
    test: Flags.boolean({char: 't'}),
    config: Flags.string({
      char: 'c',
      required: true
    }),
    domain: Flags.string({
      char: 'd',
      required: true
    })
  }
  static args = [
    {name: 'command'},
  ]

  static config = {
    name: 'Nomad Upgrade',
    version: '0.0.1',
  }

  async run() {
    dotenv.config();
    const {flags} = await this.parse(upgradeCLI);
    const {args} = await this.parse(upgradeCLI);

    const config: config.NomadConfig = this.getConfigFromPath(flags.config);
    const networks = config.networks;

    this.announce("Welcome to Nomgrade")

    // If test, then replace rpc endpoints with local ones
    if (flags.test) {
      this.announce("Upgrade script will run in test mode");
      console.log("It expects to find local EVM-compatible RPC endpoints, that listen on an incrementing port number, starting at 8545");
      console.log("Use multi-anvil to quickly spin up multiple anvil instances with incrementing port number");
      this.announce("RPC endpoints")
      for (let index in networks) {
        let port: number = 8545 + parseInt(index);
        config.rpcs[networks[index]][0] = `http://127.0.0.1:${port}`;
      }
      console.log(config.rpcs);
    }

    if (args.command == 'upgrade') {
      this.upgrade(config, flags.resume);
    } else if (args.command == 'batch') {
      this.executeCallBatch(config, flags.domain);
    }
  }
  async executeCallBatch(config: config.NomadConfig, domainName: string) {
    const rpc = config.rpcs[domainName][0];
    const path = `./upgrade-artifacts/${domainName}/artifacts.json`
    const privateKey = process.env.PRIVATE_KEY || '';
    try {
      // try loading as a local filepath
      const artifacts = JSON.parse(fs.readFileSync(path).toString());
      if (artifacts.batch.length == 0) {
        throw new Error(`batchCallData artifact is empty for domain ${domainName}. Run the upgrade script or manually create an artifacts.json file with the required fields`);
      }
      process.env['NOMAD_CALL_BATCH'] = artifacts.batch;
      process.env['NOMAD_GOV_ROUTER'] = config.core[domainName].governanceRouter.proxy;

    } catch (e) {
      throw e;
    }
    const command = this.forgeScriptCommand(domainName, "executeCallBatchCall(string)", `${domainName}`, 'UpgradeActions', rpc, privateKey, false);
    this.executeCommand(domainName, command, 'executeCallBatch-output')
  }
  async upgrade(config: config.NomadConfig, resume: boolean) {

    const networks = config.networks;
    const rpcs = config.rpcs;

    for (const network of networks) {

      const networkConfig = config.protocol.networks[network];
      const timelock = networkConfig.configuration.governance.recoveryTimelock;

      // Beacons for Core contracts
      const homeBeacon = config.core[network].home.beacon;
      const governanceRouterBeacon = config.core[network].governanceRouter.beacon;

      // Beacons for Bridge contracts
      const bridgeRouterBeacon = config.bridge[network].bridgeRouter.beacon;
      const tokenRegistryBeacon = config.bridge[network].tokenRegistry.beacon;
      const bridgeToken = config.bridge[network].bridgeToken.beacon;
      // Get first replica beacon, doesn't matter which
      // All replicas in every domain, share the same beacon, as they share the same implementation
      // but have different proxies, because they have different storage. They are different instances
      // of the same "object/thing"
      const replica = config.core[network].replicas[Object.keys(config.core[network].replicas)[0]].beacon;

      // UpgradeBeaconController and Governance Router
      const governanceRouterProxy = config.core[network].governanceRouter.proxy;
      const upgradeBeaconController = config.core[network].upgradeBeaconController;

      // Set env variables to be picked up by forge script
      // Set beacon addresses
      process.env['NOMAD_HOME_BEACON'] = homeBeacon;
      process.env['NOMAD_GOVERNANCE_ROUTER_BEACON'] = governanceRouterBeacon;
      process.env['NOMAD_BRIDGE_ROUTER_BEACON'] = bridgeRouterBeacon;
      process.env['NOMAD_TOKEN_REGISTRY_BEACON'] = tokenRegistryBeacon;
      process.env['NOMAD_BRIDGE_ROUTER_BEACON'] = bridgeToken;
      process.env['NOMAD_REPLICA_BEACON'] = replica;

      // set env variable for timelock
      process.env['NOMAD_RECOVERY_TIMELOCK'] = timelock.toString();
      process.env['NOMAD_BEACON_CONTROLLER'] = upgradeBeaconController;
      process.env['NOMAD_GOVERNANCE_ROUTER'] = governanceRouterProxy;

      // Arguments for upgrade script's function signature
      const domainName: string = networkConfig.name;
      const domain: number = networkConfig.domain;

      // flag arguments for forge script
      const rpc = rpcs[network][0];
      const privateKey = process.env.PRIVATE_KEY || '';
      if (privateKey.length == 0) {
        throw new Error("Mising private key in .env. Please set the PRIVAT_KEY variable and run again")
      }
      // forge script command with all the arguments, ready to be executed
      const command: string = this.forgeScriptCommand(domainName, 'upgrade(uint32, string)',
        `${domain} ${domainName}`, 'Upgrade', rpc, privateKey, resume);

      // Create directory for upgrade artifacts
      fs.mkdir(`./upgrade-artifacts/${domainName}`, {recursive: true}, (err) => {
        if (err) throw err;
      });

      this.executeCommand(domainName, command, 'upgrade-output')

    }

  }

  executeCommand(domainName: string, command: string, outputFile: string) {

    // Execute forge script
    exec(command, (error, stdout, stderr) => {
      console.log(stdout);

      // Write raw output to file
      fs.writeFile(`./upgrade-artifacts/${domainName}/${outputFile}.txt`, stdout, function (err) {
        if (err) {
          return console.log(`Failed to write upgrade artifact with Error: ${err}`);
        }
      });

      // Extract artifacts from raw output and store them in a JSON file
      // Only if it's during an upgrade process
      if (outputFile == 'upgrade-output') {
        const artifacts = this.extractArtifacts(stdout);
        fs.writeFile(`./upgrade-artifacts/${domainName}/artifacts.json`, JSON.stringify(artifacts), function (err) {
          if (err) {
            return console.log(`Failed to write upgrade artifact with Error: ${err}`);
          }
        });
      }
      if (error) {
        console.log(`error: ${error.message}`);
        throw new Error(`Forge script failed to run for ${domainName}`);
      }
    });

  }

  forgeScriptCommand(domainName: string, commandSignature: string, args: string, targetContract: string, rpcUrl: string, privateKey: string, resume: boolean): string {
    let resumeOrBroadcast;
    if (resume) {
      resumeOrBroadcast = '--resume';
    } else {
      resumeOrBroadcast = '--broadcast';
    }
    const pieces = [
      'forge clean',
      '&&',
      `cd ./upgrade-artifacts/${domainName}`,
      '&&',
      'forge script',
      `--tc ${targetContract}`,
      `--rpc-url ${rpcUrl}`,
      `${resumeOrBroadcast}`,
      `--private-key ${privateKey}`,
      `--sig '${commandSignature}'`,
      '--force',
      '--slow',
      '--silent',
      '../../solscripts/Upgrade.sol',
      `${args}`
    ];
    return pieces.join(' ');
  }


  getConfigFromPath(path: string) {
    try {
      // try loading as a local filepath
      return JSON.parse(fs.readFileSync(path).toString());
    } catch (e) {
      throw e;
    }
  }

  extractArtifacts(output: string): artifacts {
    const lines = output.split('\n');
    let artifact: artifacts = {
      batch: ""
    }
    lines.forEach((value, index) => {
      console.log("new line: " + value);
      if (value.includes("executeCallBatch-artifact")) {
        // The next line will be the calldata encoded as a hex string
        // Due to how it's being output, whitespace characters can be generated. We
        // make sure to remove them, as they are invalid.
        artifact.batch = lines[index + 1].replace(/\s/g, '');
      }
    });
    return artifact;
  }

  announce(what: string) {
    console.log();
    console.log('===================================');
    console.log(what);
    console.log('===================================');
    console.log();
  }
}


interface artifacts {

  batch: string

}

upgradeCLI.run();
