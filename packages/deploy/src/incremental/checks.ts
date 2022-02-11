import { BridgeContext } from '@nomad-xyz/bridge-sdk';
import { expect, AssertionError } from 'chai';
import { Waiter } from './utils';

export async function checkHubAndSpokeConnections(
  sdk: BridgeContext,
  spokeDomain: number,
  watchers: string[],
) {
  const hubCore = await sdk.governorCore();
  const hubBridge = sdk.mustGetBridge(hubCore.domain);

  const spokeCore = await sdk.mustGetCore(spokeDomain);
  const spokeBridge = await sdk.mustGetBridge(spokeDomain);

  // Checking that all watchers of new deploy are
  // enrolled at one of the old chains' xAppConnectionManager
  for (const wAddress of watchers.map((w) => w.toLowerCase())) {
    const permissionExists =
      await hubCore.xAppConnectionManager.watcherPermission(
        wAddress,
        spokeDomain,
      );
    expect(
      permissionExists,
      `No permission exists for watcher '${wAddress}' and domain: ${spokeDomain}`,
    );
  }

  // Checking that new bridge router of new deploy is
  // enrolled at one of the old chains' bridgeRouter
  const bridgeRouterAddress = await hubBridge.bridgeRouter.remotes(spokeDomain);
  expect('0x' + bridgeRouterAddress.slice(26).toLowerCase()).to.equal(
    spokeBridge.bridgeRouter.address.toLowerCase(),
    `Wrong remote BridgeRouter address at hub`,
  );

  // Checking that new replica of the new deploy at old chain is
  // enrolled at one of the old chains' xAppConnectionManager
  const actualReplicaAddress = hubCore
    .getReplica(spokeDomain)!
    .address.toLowerCase();
  const replicaAddress = await hubCore.xAppConnectionManager.domainToReplica(
    spokeDomain,
  );
  expect(replicaAddress.toLowerCase()).to.equal(
    actualReplicaAddress,
    `Wrong Replica address at hub for ${spokeDomain}`,
  );

  // Checking that new governance router of the new deploy is
  // enrolled at one of the old chains' governance router
  const govRouterAddress = await hubCore.governanceRouter.routers(spokeDomain);
  expect('0x' + govRouterAddress.slice(26).toLowerCase()).to.equal(
    spokeCore.governanceRouterAddress.toLowerCase(),
    `Wrong remote GovernanceRouter address at hub`,
  );

  console.log('Checks passed!');
}

export async function checkHubToSpokeConnectionWithWaiter(
  sdk: BridgeContext,
  spokeDomain: number,
  watchers: string[],
): Promise<void> {
  let lastError: typeof AssertionError | undefined = undefined;
  const w = new Waiter(
    async () => {
      try {
        await checkHubAndSpokeConnections(sdk, spokeDomain, watchers);
        return true;
      } catch (e: any) {
        lastError = e;
        // return undefined means that we want to retry polling this function inside of the `Waiter`
        return undefined;
      }
    },
    800_000, // timeout 800 seconds
    5_000, // polling period 5 seconds
  );
  const [_, success] = await w.wait();
  if (!success)
    throw new Error(`Incremental deploy check failed: '${lastError}'`);
}
