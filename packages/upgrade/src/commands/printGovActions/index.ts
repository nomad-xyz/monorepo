import { CliUx, Flags } from "@oclif/core";
import { NomadContext } from "@nomad-xyz/sdk";
import { Call, CallBatch } from "@nomad-xyz/sdk-govern";
import * as contracts from "@nomad-xyz/contracts-core";
import * as configuration from "@nomad-xyz/configuration";
import Command from "../../base";
import Artifacts from "../../artifacts";

export default class PrintGovActions extends Command {
  static flags = {
    ...Command.flags,
    domains: Flags.string({
      char: "d",
      multiple: true,
      exclusive: ["all"],
      description: `
Run the command on specific domain(s). To pass multiple domains, simply pass them like this: -d ethereum evmos avalanche.
Due to a parsing bug, this flag must be passed at the end of the command. e.g 'nomgrade upgrade -d ethereum'`,
    }),
    all: Flags.boolean({
      char: "a",
      description: "Run on all the domains that exist in the config file",
      exclusive: ["domains"],
    }),
  };
  static description =
    "Print governance actions to upgrade the Nomad protocol according to latest config";
  static usage = "printGovActions -c <path_to_config>";

  flags: any;
  domains: any;
  async run(): Promise<void> {
    CliUx.ux.action.start(`Printing Governance Actions`);

    // parse flags from CLI command
    const { flags } = await this.parse(PrintGovActions);
    this.flags = flags;

    // Set domains
    this.setDomains();

    console.log(
      `Government Actions will be generated for the following domains: ${this.domains}`
    );

    try {
      await PrintGovActions.print(
        this.domains,
        this.nomadConfig,
        this.workingDir
      );
    } catch (error) {
      this.error(`${error}`);
    }
    CliUx.ux.action.stop("Governance Actions printed!");
  }

  static async print(
    domains: string[],
    config: configuration.NomadConfig,
    workingDir: string
  ) {
    // instantiate empty CallBatch from config
    const context = new NomadContext(config);
    console.log(context.governor);
    const batch = CallBatch.fromContext(context);

    // for each domain, construct governance actions & push them to batch
    for (const domainName of domains) {
      // get config information for the domain
      const protocolConfig = config.protocol.networks[domainName];
      const core = config.core[domainName];
      const bridge = config.bridge[domainName];

      // instantiate upgrade beacon controller contract
      const upgradeBeaconController =
        contracts.UpgradeBeaconController__factory.connect(
          core.upgradeBeaconController,
          context.getConnection(domainName)!
        );

      // load an array of contracts to upgrade
      const upgradableContracts: configuration.Proxy[] = [
        core.home,
        core.replicas[Object.keys(core.replicas)[0]],
        core.governanceRouter,
        bridge.tokenRegistry,
        bridge.bridgeRouter,
        bridge.bridgeToken,
      ];

      // for each of the contracts to upgrade on this domain,
      for (const proxySetup of upgradableContracts) {
        // get the beacon and new implementation
        const { beacon, implementation } = proxySetup;
        // TODO: make idempotent; check the current beacon implementation on-chain; queue upgrade tx iff it's different
        // construct the upgrade call
        const call = await upgradeBeaconController.populateTransaction.upgrade(
          beacon,
          implementation
        );
        // push the upgrade call to the batch
        batch.push(protocolConfig.domain, call as Call);
      }
    }

    // build & write governance batch
    await batch.build();
    const jsonBatch = batch.toJSON();
    console.log();
    console.log("Callbatches for execution and Governance Actions");
    console.log("================================================");
    console.log();
    console.log("Local Batches");
    console.log();
    console.log(jsonBatch.local);
    console.log();
    console.log("Remote Batches");
    console.log();
    console.log(jsonBatch.remote);
    console.log();
    console.log("Execute Governance Actions built calldata");
    console.log(jsonBatch.built);
    // store the call batches
    Artifacts.storeCallBatches(config.environment, workingDir, jsonBatch);
  }
  private setDomains() {
    if (!this.flags.domains && !this.flags.all) {
      throw new Error(
        "No domains were passed via the appropriate flags. You need to select to which domains the Nomad protocol will be upgraded. Type --help for more"
      );
    }
    this.domains = this.flags.all
      ? this.nomadConfig.networks
      : this.flags.domains;
  }
}
