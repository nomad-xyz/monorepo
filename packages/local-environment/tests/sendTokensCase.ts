import { HardhatNetwork } from "../src/network";
import { Env } from "../src/le";
import { Key } from "../src/key";
import type { TokenIdentifier } from "@nomad-xyz/sdk/nomad/tokens";
import fs from "fs";
import { getCustomToken } from "./utils/token/deployERC20";
import { getRandomTokenAmount } from "../src/utils";
import { sendTokensAndConfirm } from "./common";
import bunyan from 'bunyan';

(async () => {

  // Test setup
  // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
  const log = bunyan.createLogger({name: 'localenv'});

  const t = new HardhatNetwork('tom', 1, []);

  const j = new HardhatNetwork('jerry', 2, []);

  await Promise.all([
      t.up(),
      j.up(),
  ])

  log.info(`Upped Tom and Jerry`);

  const le = new Env({domain: t.domainNumber, id: '0x'+'20'.repeat(20)});

  le.addNetwork(t);
  le.addNetwork(j);
  log.info(`Added Tom and Jerry`);

  // Set keys
  t.setUpdater(new Key(`` + process.env.PRIVATE_KEY_1 + ``));
  t.setWatcher(new Key(`` + process.env.PRIVATE_KEY_2 + ``));
  t.setRelayer(new Key(`` + process.env.PRIVATE_KEY_3 + ``));
  t.setKathy(new Key(`` + process.env.PRIVATE_KEY_4 + ``));
  t.setProcessor(new Key(`` + process.env.PRIVATE_KEY_5 + ``));
  t.setGovernanceKeys(new Key(`` + process.env.PRIVATE_KEY_1 + ``)); // setGovernanceKeys should have the same PK as the signer keys
  t.setSigner(new Key(`` + process.env.PRIVATE_KEY_1 + ``));

  const sender = new Key();
  const receiver = new Key();

  j.setUpdater(new Key(`` + process.env.PRIVATE_KEY_1 + ``));
  j.setWatcher(new Key(`` + process.env.PRIVATE_KEY_2 + ``));
  j.setRelayer(new Key(`` + process.env.PRIVATE_KEY_3 + ``));
  j.setKathy(new Key(`` + process.env.PRIVATE_KEY_4 + ``));
  j.setProcessor(new Key(`` + process.env.PRIVATE_KEY_5 + ``));
  j.setGovernanceKeys(new Key(`` + process.env.PRIVATE_KEY_1 + ``));
  j.setSigner(new Key(`` + process.env.PRIVATE_KEY_1 + ``));
  log.info(`Added Keys`)
  
  t.connectNetwork(j);
  j.connectNetwork(t);
  log.info(`Connected Tom and Jerry`);

  // Notes, check governance router deployment on Jerry and see if that's actually even passing
  // ETHHelper deployment may be failing because of lack of governance router, either that or lack of wETH address.

  await Promise.all([
      t.setWETH(t.deployWETH()),
      j.setWETH(j.deployWETH())
  ])

  log.info(await le.deploy());

  // let myContracts = le.deploymyproject();

  await t.upAgents(t, le, 9080);
  await j.upAgents(j, le, 9090);
  log.info(`Agents up`);

  // fs.writeFileSync("/tmp/nomad.json", JSON.stringify(n.toObject()));

  // Scenario

  let success = false;

  try {
    // Deploying a custom ERC20 contract
    const tokenFactory = getCustomToken();
    const tokenOnTom = await t.deployToken(
      tokenFactory,
      sender.toAddress(),
      "MyToken",
      "MTK"
    );
    
  // @TODO: FIX THIS ABSTRACTION
    const token: TokenIdentifier = {
      domain: t.domain,
      id: tokenOnTom.address,
    };

    // @TODO NOMAD NO LONGER EXISTS - MULTIPROVIDER?
    const ctx = n.getMultiprovider();

    // Default multiprovider comes with signer (`o.setSigner(jerry, signer);`) assigned
    // to each domain, but we change it to allow sending from different signer
    ctx.registerWalletSigner(t.name, sender.toString());
    ctx.registerWalletSigner(j.name, receiver.toString());

    // get 3 random amounts which will be bridged
    const amount1 = getRandomTokenAmount();
    const amount2 = getRandomTokenAmount();
    const amount3 = getRandomTokenAmount();

    await sendTokensAndConfirm(n, t, j, token, receiver.toAddress(), [
      amount1,
      amount2,
      amount3,
    ]);

    const tokenContract = await sendTokensAndConfirm(
      n,
      t,
      j,
      token,
      new Key().toAddress(),
      [amount3, amount2, amount1]
    );

    if (
      tokenContract.address.toLowerCase() !== token.id.toString().toLowerCase()
    ) {
      throw new Error(
        `Resolved asset at destination Jerry is not the same as the token`
      );
    }

    success = true;
  } catch (e) {
    console.error(`Test failed:`, e);
  }

  // Teardown

  await n.end();

  await Promise.all([t.down(), j.down()]);

  if (!success) process.exit(1);
})();
