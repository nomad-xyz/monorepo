import * as config from "@nomad-xyz/configuration";
import * as fs from "node:fs";
import Command from "../../Base";
import Artifacts from "../../Artifacts";
import Forge from "../../Forge";
import { Flags, CliUx } from "@oclif/core";

export default class Upgrade extends Command {
  static aliases = ["upgrade"];
  static flags = {
    ...Command.flags,
    resume: Flags.boolean({ char: "r" }),
    test: Flags.boolean({
      char: "t",
      description: `
Run the upgrade against local RPC nodes. It expects RPC endpoints with a port number that start ats '8545' and increments (e.g 8546, 8647, etc.)
`,
    }),
    privateKey: Flags.string({
      char: "k",
      description:
        "Private key to be used for issuing the upgrade transactions",
      required: true,
      env: "PRIVATE_KEY",
    }),
    etherscanKey: Flags.string({
      char: "e",
      description:
        "Etherscan API key for verifying contracts that are being deployed",
      env: "ETHERSCAN_API_KEY",
    }),
  };

  static usage = "upgrade -c <path_to_config> -k <private_key> --FLAGS";
  static examples = [
    "$ upgrade -c <path_to_config> -k <private_key> -a -r",
    "$ upgrade -c <path_to_config> -k <private_key> -d ethereum evmos",
  ];

  static description = "Upgrade the Nomad Protocol on any number of domains";

  workingConfig: config.NomadConfig;

  parsedFlags: any;
  async run(): Promise<void> {
    this.workingConfig = this.nomadConfig;
    const networks = this.workingConfig.networks;
    const { flags } = await this.parse(Upgrade);
    this.parsedFlags = flags;
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
      for (const index in networks) {
        const port: number = 8545 + Number.parseInt(index);
        this.workingConfig.rpcs[
          networks[index]
        ][0] = `http://127.0.0.1:${port}`;
      }
    }

    console.log("The following RPC endpoints will be used");
    console.log(this.nomadConfig.rpcs);

    if (!this.domains && !this.all) {
      throw new Error(
        "No domains were passed via the appropriate flags. You need to select to which domains the Nomad protocol will be upgraded. Type --help for more"
      );
    }

    const domains = this.all ? this.nomadConfig.networks : this.domains;
    this.log(`The following domains will be upgraded: ${domains}`);
    this.warn(
      "The forge output is being buffered and will be printed as the upgrade pipeline finish on each network"
    );
    CliUx.ux.action.start("Upgrading the Nomad Protocol");
    const upgrades = [];
    for (const domainName of domains) {
      upgrades.push(this.upgradeDomain(domainName, flags.resume));
    }

    await Promise.all(upgrades);
    CliUx.ux.action.stop(
      "Implementations have been deployed and artifacts have stored"
    );
  }

  async upgradeDomain(domainName: string, resume: boolean): Promise<void> {
    const config = this.workingConfig;
    const networks = config.networks;
    const rpcs = config.rpcs;

    const networkConfig = config.protocol.networks[domainName];

    // Arguments for upgrade script's function signature
    const domain: number = networkConfig.domain;

    Upgrade.setUpgradeEnv(domainName, config);

    // flag arguments for forge script
    const rpc = rpcs[domainName][0];

    // forge script command with all the arguments, ready to be executed
    const forge = new Forge(config, domainName, this.workingDir);
    forge.scriptCommand(
      domainName,
      "upgrade(uint32, string)",
      `${domain} ${domainName}`,
      "../../solscripts/Upgrade.sol",
      "Upgrade",
      rpc,
      this.parsedFlags.privateKey,
      resume,
      true
    );
    if (this.parsedFlags.etherscanKey) {
      if (this.parsedFlags.test) {
        throw new Error(
          "You can't verify contracts when running Nomgrade upgrade --test"
        );
      }
      forge.setEtherscanKey(this.parsedFlags.etherscanKey);
    }
    try {
      const { stdout, stderr } = await forge.executeCommand("upgrade-output");
      if (stdout) {
        this.log(`${stdout}`);
      }

      if (stderr) {
        this.warn(`${stderr}`);
      }

      const artifacts = new Artifacts(
        `${stdout}`,
        domainName,
        config,
        this.workingDir
      );
      artifacts.storeOutput("upgrade");
      artifacts.extractArtifacts();
      artifacts.extractImplementations();
      artifacts.updateConfig();
      artifacts.updateArtifacts();
    } catch (error) {
      this.error(`Forge execution encountered an error:${error}`);
    }
  }

  public static setUpgradeEnv(
    domainName: string,
    config: config.NomadConfig
  ): void {
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
    process.env.NOMAD_HOME_BEACON = homeBeacon;
    process.env.NOMAD_GOVERNANCE_ROUTER_BEACON = governanceRouterBeacon;
    process.env.NOMAD_BRIDGE_ROUTER_BEACON = bridgeRouterBeacon;
    process.env.NOMAD_TOKEN_REGISTRY_BEACON = tokenRegistryBeacon;
    process.env.NOMAD_BRIDGE_ROUTER_BEACON = bridgeTokenBeacon;
    process.env.NOMAD_REPLICA_BEACON = replicaBeacon;
    // set env variable for timelock
    process.env.NOMAD_RECOVERY_TIMELOCK = timelock.toString();
    process.env.NOMAD_BEACON_CONTROLLER = upgradeBeaconController;
  }
}
