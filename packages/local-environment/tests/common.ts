// import { Nomad, utils, Network, LocalNetwork, Key } from "../src";
import type { TokenIdentifier } from "@nomad-xyz/sdk-bridge/src";
import { ethers } from "ethers";
// import { TransferMessage } from "@nomad-xyz/sdk/nomad";

import { Waiter } from "../src/utils";

import { NomadEnv } from "../src/nomadenv";
import { NomadDomain } from "../src/domain";

import fs from 'fs';
import { TransferMessage } from "@nomad-xyz/sdk-bridge";

//
/**
 * Sends several amounts of tokens from network "From" to "To"
 * to particular reciver and then test that they are received
 *
 * @param n - Nomad instance which has both "from" and "to" networks
 * @param from - instance of Network *from* which the tokens will be sent
 * @param to - instance of Network *to* which the tokens will be sent
 * @param token - token identifier according to Nomad
 * @param recipient - recipient address as string at network *to*
 * @param amounts - array of amounts to be sent in bulk
 * @returns a promise of pair [`success`, `tokenContract` ERC20 if it was created]
 */
export async function sendTokensAndConfirm(
  n: NomadEnv,
  from: NomadDomain,
  to: NomadDomain,
  token: TokenIdentifier,
  recipient: string,
  amounts: ethers.BigNumberish[],
  fastLiquidity = false
) {
  console.log(`===  Start! amounts:`, amounts.map(m => m.toString()));
  const ctx = n.getBridgeSDK();
  console.log(`===  got sdk`, ctx.domainNames,ctx.domainNumbers);

  fs.writeFileSync('./ctx.json', JSON.stringify(ctx.conf));

  let amountTotal = ethers.BigNumber.from(0);

  const rr: TransferMessage[] = [];

  for (const a of amounts) {
    const amount = ethers.BigNumber.from(a);

    console.log(`Going to send token ${token.domain}:${token.id}\n`,from.name,to.name);

    const tx = await ctx.send(
      from.name,
      to.name,
      token,
      amount,
      recipient,
      fastLiquidity,
      {
        gasLimit: 10000000,
      }
    );

    rr.push(tx);

    await tx.wait();

    // tx.committedRoot

    const tokenAtDest = await tx.assetAtDestination()

    console.log(`===  Dispatched send transaction!`, from.name, to.name, tx.committedRoot, tx.bodyHash);
    console.log(`=== Token address at dest:`, tokenAtDest?.address);

    amountTotal = amountTotal.add(amount);
    
    // console.log(await tx.getUpdate())
    // console.log(`===  Got UPDATE!`);
    // console.log(await tx.getRelay())
    // console.log(`===  Got RELAY!`);
    // console.log(await tx.getProcess())
    // console.log(`===  Got PROCESS!`);

    // Wait until on tom's replica on jerry 
    const replica = ctx.mustGetCore(to.domain.domain).getReplica(from.domain.domain);
    if (replica) {
      console.log(`Waiting for update and process events...`);
      await new Promise((resolve, reject) => {
        replica.once(replica.filters.Update(null, null, null, null), (homeDomain, oldRoot, newRoot, _signature) => {
          console.log(`New Update event\n    homeDomain: ${homeDomain},\n    oldRoot: ${oldRoot},\n    newRoot: ${newRoot}`)
        })
  
        replica.once(replica.filters.Process(null, null, null), (messageHash, success, _returnData) => {
          console.log(`New Process event\n    messageHash: ${messageHash},\n    success:`, success)
          resolve(null)
        })
      })
      console.log(`Awaited process event!`);
    } else {
      console.log(`No replica`);
      throw new Error(`No replica!`);
    }

    console.log(
      `Sent from ${from.name} to ${to.name} ${amount.toString()} tokens`
    );
  }

  // rr

  // await Promise.all(amounts.map(async (a) => {
  //   const amount = ethers.BigNumber.from(a);
  //   console.log(`===  Dispatching send transaction!`);

  //   const x = await ctx.send(
  //     from.name,
  //     to.name,
  //     token,
  //     amount,
  //     recipient,
  //     fastLiquidity,
  //     {
  //       gasLimit: 10000000,
  //     }
  //   );
    
  // }))

  const batch = `${new Date().valueOf()}`.substring(-3)
  console.log(`Waiting for all assets to be delivered at from: ${from.name}, to: ${to.name} . Batch:${batch}!`);

  const tokens = await Promise.all(rr.map(r => {
    const waiter = new Waiter(async () => {
      const tokenContract = await r.assetAtDestination();

      if (
        tokenContract?.address !== "0x0000000000000000000000000000000000000000"
      ) {
        console.log(
          `${batch} = Hurray! Asset at destination's token's address `,
          tokenContract!.address,
          `\nFrom: ${from.name}, to: ${to.name}, recipient: ${recipient}`
        );
        return tokenContract;
      }
    }, 3*60_000, 2_000);
    return waiter.wait()
  }));

  // if (!tokens.every(t => t.))


  // console.log(`Waiting for asset to be created at destination!`);

  // // Waiting until the token contract is created at destination network tom
  // let waiter = new Waiter(
  //   async () => {
  //     const tokenContract = await rr[rr.length - 1]!.assetAtDestination();

  //     if (
  //       tokenContract?.address !== "0x0000000000000000000000000000000000000000"
  //     ) {
  //       console.log(
  //         `Hurray! Asset at destination:`,
  //         tokenContract!.address,
  //         `\nFrom: ${from.name}, to: ${to.name}`
  //       );
  //       return tokenContract;
  //     }
  //   },
  //   3 * 60_000,
  //   2_000
  // );

  const tokenContract = tokens[1];
  if (tokenContract === null) throw new Error(`Timedout token creation at destination`);

  if (!tokenContract) throw new Error(`no token contract`);

  let newBalance = await tokenContract!.balanceOf(recipient);

  // Waiting until all 3 transactions will land at tom
  let waiter2 = new Waiter(
    async () => {
      if (newBalance.eq(amountTotal)) {
        return true;
      } else {
        newBalance = await tokenContract!.balanceOf(recipient);
        console.log(
          `New balance:`,
          parseInt(newBalance.toString()),
          "must be:",
          parseInt(amountTotal.toString())
        );
      }
    },
    4 * 60_000,
    2_000
  );

  const success = await waiter2.wait();

  console.log(`Recipient's balance on recipient (${recipient}) domain ${to.name} is`, (await tokenContract.balanceOf(recipient)).toString());

  if (success === null)
    throw new Error(`Tokens transfer from ${from.name} to ${to.name} failed`)
  if (success === true) 
    console.log(`Received tokens from ${from.name} to ${to.name}`)

  return tokenContract!;
}

/*
Shut for now, so doesnt bother from sentTokentsCase.ts

// import fs from "fs";
// import { LocalAgent } from "../src/agent";

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


*/