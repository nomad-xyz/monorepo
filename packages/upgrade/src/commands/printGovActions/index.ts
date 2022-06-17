import { CliUx } from "@oclif/core";
import {NomadContext} from "@nomad-xyz/sdk";
import {Call, CallBatch} from "@nomad-xyz/sdk-govern";
import * as contracts from '@nomad-xyz/contracts-core';
import * as configuration from "@nomad-xyz/configuration";
import Command from "../../Base";
import Artifacts from "../../Artifacts";

export default class PrintGovActions extends Command {
  static description = "Fork test Upgrading the Nomad Protocol on any number of domains";
  static usage = "printGovActions -c <path_to_config>";

  async run() {
    CliUx.ux.action.start(`Printing Governance Actions`);
    await PrintGovActions.print(this.nomadConfig, this.workingDir);
    CliUx.ux.action.stop("Governance Actions printed!");
  }

  static async print(config: configuration.NomadConfig, workingDir: string) {
    // instantiate empty CallBatch from config
    const context = new NomadContext(config);
    const batch = CallBatch.fromContext(context);

    // for each domain, construct governance actions & push them to batch
    for (const domainName of config.networks) {
      // get config information for the domain
      const protocolConfig = config.protocol.networks[domainName];
      const core = config.core[domainName];
      const bridge = config.bridge[domainName];

      // instantiate upgrade beacon controller contract
      const upgradeBeaconController = contracts.UpgradeBeaconController__factory.connect(
          core.upgradeBeaconController,
          context.getConnection(domainName),
      );

      // load an array of contracts to upgrade
      const upgradableContracts: configuration.Proxy[] = [
        core.home,
        core.replicas[0],
        core.governanceRouter,
        bridge.tokenRegistry,
        bridge.bridgeRouter,
        bridge.bridgeToken
      ];

      // for each of the contracts to upgrade on this domain,
      for (const proxySetup of upgradableContracts) {
        // get the beacon and new implementation
        const {beacon, implementation} = proxySetup;
        // TODO: make idempotent; check the current beacon implementation on-chain; queue upgrade tx iff it's different
        // construct the upgrade call
        const call = await upgradeBeaconController.populateTransaction.upgrade(
            beacon,
            implementation,
        );
        // push the upgrade call to the batch
        batch.push(protocolConfig.domain, call as Call);
      }
    }

    // build & write governance batch
    await batch.build();

    // store the call batches
    Artifacts.storeCallBatches(workingDir, batch);
  }
}
