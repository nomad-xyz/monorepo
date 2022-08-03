import { HardhatNetwork } from "../src/network";
import { NomadEnv } from "../src/nomadenv";
import { NomadDomain } from "../src/domain";
import { Key } from "../src/keys/key";
import type { TokenIdentifier } from "@nomad-xyz/sdk-bridge";
// import fs from "fs";
import { getCustomToken } from "./utils/token/deployERC20";
import { getRandomTokenAmount } from "../src/utils";
import { sendTokensAndConfirm } from "./common";
import bunyan from 'bunyan';

(async () => {

    // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
    const log = bunyan.createLogger({name: 'localenv'});

    // Instantiate HardhatNetworks
    const t = new HardhatNetwork('tom', 1);
    const j = new HardhatNetwork('jerry', 2);

    // Instantiate Nomad domains
    const tdomain = new NomadDomain(t);
    const jdomain = new NomadDomain(j);

    // Await domains to up networks.
    await Promise.all([
      tdomain.network.up(),
      jdomain.network.up(),
    ])

    log.info(`Upped Tom and Jerry`);

    const le = new NomadEnv({domain: tdomain.network.domainNumber, id: '0x'+'20'.repeat(20)});

    le.addDomain(tdomain);
    le.addDomain(jdomain);
    log.info(`Added Tom and Jerry`);

    tdomain.connectNetwork(jdomain);
    jdomain.connectNetwork(tdomain);
    log.info(`Connected Tom and Jerry`);

    // Notes, check governance router deployment on Jerry and see if that's actually even passing
    // ETHHelper deployment may be failing because of lack of governance router, either that or lack of wETH address.

    await Promise.all([
        t.setWETH(t.deployWETH()),
        j.setWETH(j.deployWETH())
    ])

    log.info(await le.deploy());

    // let myContracts = le.deploymyproject();

    await le.upAgents(tdomain, 9080);
    await le.upAgents(jdomain, 9090);
    log.info(`Agents up`);

    const sender = new Key();
    const receiver = new Key();

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

    const tDomain = tdomain.network.name;
    
    const token: TokenIdentifier = {
      domain: tDomain,
      id: tokenOnTom.address,
    };

    const ctx = le.getBridgeSDK();

    // Default multiprovider comes with signer (`o.setSigner(jerry, signer);`) assigned
    // to each domain, but we change it to allow sending from different signer
    ctx.registerWalletSigner(t.name, sender.toString());
    ctx.registerWalletSigner(j.name, receiver.toString());

    // get 3 random amounts which will be bridged
    const amount1 = getRandomTokenAmount();
    const amount2 = getRandomTokenAmount();
    const amount3 = getRandomTokenAmount();

    await sendTokensAndConfirm(le, t, j, token, receiver.toAddress(), [
      amount1,
      amount2,
      amount3,
    ]);

    const tokenContract = await sendTokensAndConfirm(
      le,
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
  await le.stopAgents(tdomain);
  await le.stopAgents(jdomain);

  await Promise.all([t.down(), j.down()]);

  if (!success) process.exit(1);

})();
