import { Nomad, utils, Network, LocalNetwork, Key } from "../src";
import type { TokenIdentifier } from "@nomad-xyz/sdk/nomad/tokens";
import { ethers } from "ethers";
import { TransferMessage } from "@nomad-xyz/sdk/nomad";
import fs from "fs";
import { Waiter } from "../src/utils";
import { LocalAgent } from "../src/agent";

//
/**
 * Sends several amounts of tokens from network "From" to "To"
 * to particular reciver and then test that they are received
 *
 * @param n - Nomad instance which has both "from" and "to" networks
 * @param from - instance of Network *from* which the tokens will be sent
 * @param to - instance of Network *to* which the tokens will be sent
 * @param token - token identifier according to Nomad
 * @param receiver - receiver address as string at network *to*
 * @param amounts - array of amounts to be sent in bulk
 * @returns a promise of pair [`success`, `tokenContract` ERC20 if it was created]
 */
export async function sendTokensAndConfirm(
  n: Nomad,
  from: Network,
  to: Network,
  token: TokenIdentifier,
  receiver: string,
  amounts: ethers.BigNumberish[],
  fastLiquidity = false
) {
  const ctx = n.getMultiprovider();

  let amountTotal = ethers.BigNumber.from(0);

  let result: TransferMessage | undefined = undefined;
  for (const amountish of amounts) {
    const amount = ethers.BigNumber.from(amountish);

    result = await ctx.send(
      from.name,
      to.name,
      token,
      amount,
      receiver,
      fastLiquidity,
      {
        gasLimit: 10000000,
      }
    );

    amountTotal = amountTotal.add(amount);

    console.log(
      `Sent from ${from.name} to ${to.name} ${amount.toString()} tokens`
    );
  }

  if (!result) throw new Error(`Didn't get the result from transactions`);

  console.log(
    `Waiting for the last transactions of ${amounts.length} to be delivered:`
  );

  await result.wait();

  console.log(`Waiting for asset to be created at destination!`);

  // Waiting until the token contract is created at destination network tom
  let waiter = new utils.Waiter(
    async () => {
      const tokenContract = await result!.assetAtDestination();

      if (
        tokenContract?.address !== "0x0000000000000000000000000000000000000000"
      ) {
        console.log(
          `Hurray! Asset was created at destination:`,
          tokenContract!.address
        );
        return tokenContract;
      }
    },
    3 * 60_000,
    2_000
  );

  const tokenContract = await waiter.wait();
  if (tokenContract === null) throw new Error(`Timedout token creation at destination`);

  if (!tokenContract) throw new Error(`no token contract`);

  let newBalance = await tokenContract!.balanceOf(receiver);

  // Waiting until all 3 transactions will land at tom
  let waiter2 = new utils.Waiter(
    async () => {
      if (newBalance.eq(amountTotal)) {
        return true;
      } else {
        newBalance = await tokenContract!.balanceOf(receiver);
        console.log(
          `New balance:`,
          parseInt(newBalance.toString()),
          "must be:",
          parseInt(tokenContract.toString())
        );
      }
    },
    4 * 60_000,
    2_000
  );

  const success = await waiter2.wait();

  if (success === null)
    throw new Error(`Tokens transfer from ${from.name} to ${to.name} failed`);

  return tokenContract!;
}

export async function setupTwo() {
  const tom = new LocalNetwork("tom", 1000, "http://localhost:9545");
  const jerry = new LocalNetwork("jerry", 2000, "http://localhost:9546");

  const tomActor = new Key();
  const jerryActor = new Key();

  const t = utils.generateDefaultKeys();
  const j = utils.generateDefaultKeys();

  tom.addKeys(
    tomActor,
    t.updater,
    t.watcher,
    t.deployer,
    t.signer.base,
    t.signer.updater,
    t.signer.watcher,
    t.signer.relayer,
    t.signer.processor
  );
  jerry.addKeys(
    jerryActor,
    j.updater,
    j.watcher,
    j.deployer,
    j.signer.base,
    j.signer.updater,
    j.signer.watcher,
    j.signer.relayer,
    j.signer.processor
  );

  await Promise.all([tom.up(), jerry.up()]);

  const n = new Nomad(tom);
  n.addNetwork(jerry);

  n.setUpdater(jerry, j.updater); // Need for an update like updater
  n.setWatcher(jerry, j.watcher); // Need for the watcher
  n.setDeployer(jerry, j.deployer); // Need to deploy all
  n.setSigner(jerry, j.signer.base); // Need for home.dispatch
  n.setSigner(jerry, j.signer.updater, "updater"); // Need for home.dispatch
  n.setSigner(jerry, j.signer.relayer, "relayer"); // Need for home.dispatch
  n.setSigner(jerry, j.signer.watcher, "watcher"); // Need for home.dispatch
  n.setSigner(jerry, j.signer.processor, "processor"); // Need for home.dispatch

  n.setUpdater(tom, t.updater); // Need for an update like updater
  n.setWatcher(tom, t.watcher); // Need for the watcher
  n.setDeployer(tom, t.deployer); // Need to deploy all
  n.setSigner(tom, t.signer.base); // Need for home.dispatch
  n.setSigner(tom, t.signer.updater, "updater"); // Need for home.dispatch
  n.setSigner(tom, t.signer.relayer, "relayer"); // Need for home.dispatch
  n.setSigner(tom, t.signer.watcher, "watcher"); // Need for home.dispatch
  n.setSigner(tom, t.signer.processor, "processor"); // Need for home.dispatch

  await n.deploy({ injectSigners: true });

  n.exportDeployArtifacts("../../rust/config");

  fs.writeFileSync("/tmp/nomad.json", JSON.stringify(n.toObject()));

  return {
    tom,
    jerry,
    tomActor,
    jerryActor,
    n,
  };
}

export async function waitAgentFailure(
  n: Nomad,
  network: Network,
  agentType: string
): Promise<Waiter<true>> {
  const agent = (await n.getAgent(agentType, network)) as LocalAgent;

  let startsCount = 0;
  let homeFailed = false;

  await agent.connect();

  const agentEvents = await agent.getEvents();

  agentEvents.on("start", () => {
    console.log(
      `   =========================   ${agentType} started   =========================   `
    );
    startsCount += 1;
  });

  agent.logMatcherRegisterEvent(
    "homeFailed",
    /Home contract is in failed state/
  );

  agentEvents.once("logs.homeFailed", () => {
    console.log(
      `   =========================   ${agentType} homeFailed   =========================   `
    );
    homeFailed = true;
  });
  await agent.start();

  return new Waiter(
    async (): Promise<true | undefined> => {
      if (
        homeFailed &&
        startsCount >= 3 // initial start + 1st failed start after the first failure + 2nd failed start
      ) {
        return true;
      }
    },
    10 * 60_000,
    2_000
  );
}
