import { ethers } from "ethers";
import { Key, utils } from "../src";
import { setupTwo } from "./common";

(async () => {
  let success: boolean | null = false;

  const { tom, jerry, n } = await setupTwo();

  // Scenario

  const tomWatcher = await n.getAgent("watcher", tom);
  await tomWatcher.connect();
  await tomWatcher.start();

  try {
    const address = new Key().toAddress();

    const home = n.getCore(tom).home;

    if (!home) throw new Error(`no home`);

    const xapp = await n.getXAppConnectionManager(jerry);

    await (
      await home.dispatch(
        jerry.domain,
        ethers.utils.hexZeroPad(address, 32),
        Buffer.from(`01234567890123456789012345678`, "utf8")
      )
    ).wait();

    console.log(`Dispatched test transaction to home`);

    const [commitedRoot, newRoot] = await home.suggestUpdate();

    const updater = await n.getUpdater(tom);

    const { signature } = await updater.signUpdate(commitedRoot, newRoot);

    await (await home.update(commitedRoot, newRoot, signature)).wait();

    console.log(`Submitted valid update to home`);

    const replica = n.getCore(jerry).getReplica(tom.domain)!;
    if (!replica) throw new Error(`no replica`);

    const fraudRoot =
      "0x8bae0a4ab4517a16816ef67120f0e3350d595e014158ba72c3626d8c66b67e53";

    const { signature: fraudletSignature } = await updater.signUpdate(
      commitedRoot,
      fraudRoot
    );
    await (
      await replica.update(commitedRoot, fraudRoot, fraudletSignature)
    ).wait();

    console.log(`Submitted fraudulent update to replica`);

    const [homeCommitedRoot, homeRoot, replicaCommitedRoot] = await Promise.all(
      [home.committedRoot(), home.root(), replica.committedRoot()]
    );

    if (homeCommitedRoot !== homeRoot)
      throw new Error(`Home contract's root is not equal to committed root`);

    if (homeRoot === replicaCommitedRoot)
      throw new Error(
        `Home contract's root should not be equal to replica's committed root`
      );

    if (replicaCommitedRoot !== fraudRoot)
      throw new Error(
        `Fraud didn't happen: replica's root hasn't been set to fraud root`
      );

    // Waiting for Home, Replica will fail, and XAppConnectionManager will unenroll the Replica
    const waiter = new utils.Waiter(
      async () => {
        const [homeState, replicaState, domainToReplica, replicaToDomain] =
          await Promise.all([
            home.state(),
            replica.state(),

            xapp.domainToReplica(tom.domain),
            xapp.replicaToDomain(replica.address),
          ]);

        if (
          homeState === 2 && // Waiting till Home state will be failed (2)
          replicaState === 2 && // Waiting till Replica state will be failed (2)
          domainToReplica !== replica.address && // Waiting till XAppConnectionManager will stop pointing at replica's address for jerry's domian
          replicaToDomain !== tom.domain // Waiting till XAppConnectionManager will stop pointing at jerry's domian for replica's address
        ) {
          return true;
        }
      },
      3 * 60_000,
      2_000
    );

    success = await waiter.wait();

    if (success === null) throw new Error(`Fraud was not prevented in time!`);
    success = true;
  } catch (e) {
    console.log(`Faced an error:`, e);
  }

  // Teardown

  await n.end();

  await Promise.all([tom.down(), jerry.down()]);

  if (!success) process.exit(1);
})();
