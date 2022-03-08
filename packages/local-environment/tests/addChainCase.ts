import { LocalNetwork, Nomad, Key, utils, Network } from "../src";
import fs from "fs";
import { getCustomToken } from "./utils/token/deployERC20";
import { getRandomTokenAmount, sleep } from "../src/utils";
import { sendTokensAndConfirm, setupTwo } from "./common";

async function setupDaffy(n: Nomad) {
  const daffy = new LocalNetwork("daffy", 3000, "http://localhost:9547");

  const d = utils.generateDefaultKeys();

  const daffyActor = new Key();

  daffy.addKeys(
    daffyActor,
    d.updater,
    d.watcher,
    d.deployer,
    d.signer.base,
    d.signer.updater,
    d.signer.watcher,
    d.signer.relayer,
    d.signer.processor
  );

  await daffy.up();

  n.addNetwork(daffy);

  n.setUpdater(daffy, d.updater); // Need for an update like updater
  n.setWatcher(daffy, d.watcher); // Need for the watcher
  n.setDeployer(daffy, d.deployer); // Need to deploy all
  n.setSigner(daffy, d.signer.base); // Need for home.dispatch
  n.setSigner(daffy, d.signer.updater, "updater"); // Need for home.dispatch
  n.setSigner(daffy, d.signer.relayer, "relayer"); // Need for home.dispatch
  n.setSigner(daffy, d.signer.watcher, "watcher"); // Need for home.dispatch
  n.setSigner(daffy, d.signer.processor, "processor"); // Need for home.dispatch

  // Another deploy here will automatically determine whether
  // there are new chains to be deployed. Here it will
  // incrementally deploy the "daffy" chain
  await n.deploy({ injectSigners: true });

  fs.writeFileSync("/tmp/nomad.json", JSON.stringify(n.toObject()));

  return {
    daffy,
    daffyActor,
  };
}

async function sendTokensTriangular(
  a: Network,
  b: Network,
  c: Network,
  aActor: Key,
  bActor: Key,
  cActor: Key,
  n: Nomad
) {
  const tokenFactory = getCustomToken();
  const tokenOnA = await a.deployToken(
    tokenFactory,
    aActor.toAddress(),
    "MyToken",
    "MTK"
  );

  const token = {
    domain: a.domain,
    id: tokenOnA.address,
  };

  const ctx = n.getMultiprovider();

  ctx.registerWalletSigner(a.name, aActor.toString());
  ctx.registerWalletSigner(b.name, bActor.toString());

  ctx.registerWalletSigner(c.name, cActor.toString());

  // get 3 random amounts which will be bridged
  const amount1 = getRandomTokenAmount();
  const amount2 = getRandomTokenAmount();
  const amount3 = getRandomTokenAmount();

  await sendTokensAndConfirm(n, a, b, token, bActor.toAddress(), [
    amount1,
    amount2,
    amount3,
  ]);

  await sendTokensAndConfirm(n, b, c, token, cActor.toAddress(), [
    amount3,
    amount2,
    amount1,
  ]);

  const tokenContract = await sendTokensAndConfirm(
    n,
    c,
    a,
    token,
    new Key().toAddress(), // to random address
    [amount1, amount3, amount2]
  );

  if (
    tokenContract.address.toLowerCase() !== token.id.toString().toLowerCase()
  ) {
    throw new Error(
      `Resolved asset at destination Jerry is not the same as the token`
    );
  }
}

async function sendTokensHubAndSpoke(
  a: Network,
  b: Network,
  c: Network,
  aActor: Key,
  bActor: Key,
  cActor: Key,
  n: Nomad
) {
  const tokenFactory = getCustomToken();
  const tokenOnA = await a.deployToken(
    tokenFactory,
    aActor.toAddress(),
    "MyToken",
    "MTK"
  );

  const token = {
    domain: a.domain,
    id: tokenOnA.address,
  };

  const ctx = n.getMultiprovider();

  ctx.registerWalletSigner(a.name, aActor.toString());
  ctx.registerWalletSigner(b.name, bActor.toString());
  ctx.registerWalletSigner(c.name, cActor.toString());

  // get 3 random amounts which will be bridged
  const amount1 = getRandomTokenAmount();
  const amount2 = getRandomTokenAmount();
  const amount3 = getRandomTokenAmount();

  // send tokens A to C
  await sendTokensAndConfirm(n, a, c, token, cActor.toAddress(), [
    amount2,
    amount3,
    amount1,
  ]);

  // send tokens A to B
  await sendTokensAndConfirm(n, a, b, token, bActor.toAddress(), [
    amount1,
    amount2,
  ]);

  // send tokens B to A
  const tokenContract1 = await sendTokensAndConfirm(
    n,
    b,
    a,
    token,
    new Key().toAddress(),
    [amount1, amount2]
  );

  // send tokens C to A
  const tokenContract2 = await sendTokensAndConfirm(
    n,
    c,
    a,
    token,
    new Key().toAddress(),
    [amount2, amount3, amount1]
  );

  // send tokens C to B (should fail!!)
  let tokenSendFailed = true;
  try {
    await sendTokensAndConfirm(n, c, b, token, new Key().toAddress(), [
      amount2,
      amount3,
      amount1,
    ]);
    tokenSendFailed = false;
  } catch (e) {
    console.log(`Failed sending from ${c.name} to ${b.name} as expected`);
  }
  if (!tokenSendFailed)
    throw new Error(`Supposed to not be able to send tokens`);

  if (
    tokenContract1.address.toLowerCase() !==
      token.id.toString().toLowerCase() ||
    tokenContract2.address.toLowerCase() !== token.id.toString().toLowerCase()
  ) {
    throw new Error(
      `Resolved asset at destination Jerry is not the same as the token`
    );
  }
}

async function teardown(n: Nomad) {
  await n.end();

  await Promise.all(n.getNetworks().map((net) => net.down()));
}

(async () => {
  // Normally setup and deploy 2 local networks
  const { tom, jerry, tomActor, jerryActor, n } = await setupTwo();
  await n.startAgents(["updater", "relayer", "processor"]);

  console.log(`Tom and Jerry setup complete`);

  let success = false;
  try {
    // Perform incremental deploy of new network daffy
    const { daffy, daffyActor } = await setupDaffy(n);
    await n.stopAllAgents(true);
    await n.startAgents(["updater", "relayer", "processor"]);

    console.log(`Daffy setup complete`);

    await sendTokensHubAndSpoke(
      tom,
      jerry,
      daffy,
      tomActor,
      jerryActor,
      daffyActor,
      n
    );
    success = true;
  } catch (e) {
    console.error(`Test failed:`, e);
  }

  await teardown(n);

  if (!success) process.exit(1);
})();
