// import { NomadContext } from '@nomad-xyz/sdk';
import { BridgeContext } from '@nomad-xyz/bridge-sdk'
import { CallBatch } from '@nomad-xyz/govern-sdk';
import { utils as mpUtils } from '@nomad-xyz/multi-provider';
import { CoreConfig } from '../core/CoreDeploy';
import { writeBatchOutput } from './utils';

/**
 * Prepares and executes necessary calls to governing
 * router for enrolling a spoke after core and
 * bridge have been deployed
 * @param sdk SDK containing new spoke domain
 * @param spokeDomain domain of the spoke
 * @param watchers set of watchers to be enrolled
 */
export async function enrollSpoke(
  sdk: BridgeContext,
  spokeDomain: number,
  spokeConfig: CoreConfig,
): Promise<void> {
  const hubCore = await sdk.governorCore();
  const hubBridge = sdk.mustGetBridge(hubCore.domain);

  const spokeCore = await sdk.mustGetCore(spokeDomain);
  const spokeBridge = await sdk.mustGetBridge(spokeDomain);
  const batch = await CallBatch.fromContext(sdk);

  // enroll watchers
  await Promise.all(
    spokeConfig.watchers.map(async (watcher) => {
      const call =
        await hubCore.xAppConnectionManager.populateTransaction.setWatcherPermission(
          watcher,
          spokeDomain,
          true,
        );
      batch.pushLocal(call);
    }),
  );

  // enroll replica
  const hubReplicaOfSpoke = hubCore.getReplica(spokeDomain)?.address;
  const enrollReplicaCall =
    await hubCore.xAppConnectionManager.populateTransaction.ownerEnrollReplica(
      hubReplicaOfSpoke!,
      spokeDomain,
    );
  batch.pushLocal(enrollReplicaCall);
  // set router remote
  const setRouterCall =
    await hubCore.governanceRouter.populateTransaction.setRouterLocal(
      spokeDomain,
      mpUtils.canonizeId(spokeCore.governanceRouter.address),
    );
  batch.pushLocal(setRouterCall);
  // enroll bridge
  const enrollBridgeCall =
    await hubBridge.bridgeRouter.populateTransaction.enrollRemoteRouter(
      spokeDomain,
      mpUtils.canonizeId(spokeBridge.bridgeRouter.address),
    );
  batch.pushLocal(enrollBridgeCall);

  if (spokeConfig.environment === 'dev') {
    // in dev, execute the batch directly
    console.log('Sending governance transaction...');
    const txResponse = await batch.execute();
    const receipt = await txResponse.wait();
    console.log('Governance tx mined!! ', receipt.transactionHash);
  } else {
    // in staging and prod, output batch to a file
    const built = await batch.build();
    const unbuiltStr = JSON.stringify(
      { local: batch.local, remote: batch.remote },
      null,
      2,
    );
    const builtStr = JSON.stringify(built, null, 2);
    console.log('Writing governance transaction to file');
    writeBatchOutput(builtStr, unbuiltStr, spokeConfig.environment);
    console.log('Done!');
    // TODO: send to gnosis safe directly
  }
}
