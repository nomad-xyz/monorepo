import * as configuration from "@nomad-xyz/configuration";
import Command from "../../Base";
import { CliUx } from "@oclif/core";
import Artifacts from "../../Artifacts";
import {NomadContext} from "@nomad-xyz/sdk";
import {Call, CallBatch} from "@nomad-xyz/sdk-govern";
import * as contracts from '@nomad-xyz/contracts-core';

export default class PrintGovActions extends Command {
  static usage = "printGovActions -c <path_to_config>";

  async run() {
    // instantiate empty CallBatch from config
    const config: configuration.NomadConfig = this.newNomadConfig;
    const context = new NomadContext(config);
    const batch = CallBatch.fromContext(context);

    // for each domain, construct governance actions & push them to batch
    for (const domainName of config.networks) {
      CliUx.ux.action.start(`Printing GovChainActions for ${domainName}`);

      const protocolConfig = config.protocol.networks[domainName];
      const core = config.core[domainName];
      const bridge = config.bridge[domainName];

      // instantiate upgrade beacon controller contract
      const upgradeBeaconController = contracts.UpgradeBeaconController__factory.connect(
          core.upgradeBeaconController,
          context.getConnection(domainName),
      );

      // load an array of contracts to upgrade
      const contractsToUpgrade: configuration.Proxy[] = [
          core.home,
          core.replicas[0],
          core.governanceRouter,
          bridge.tokenRegistry,
          bridge.bridgeRouter,
          bridge.bridgeToken
      ];

      // for each of the contracts to upgrade on this domain,
      for (const proxySetup of contractsToUpgrade) {
        // get the beacon and new implementation
        const {beacon, implementation} = proxySetup;
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
    Artifacts.storeCallBatches(this.workingDir, batch);
    CliUx.ux.action.stop("GovChainActions printed!");
  }
}
