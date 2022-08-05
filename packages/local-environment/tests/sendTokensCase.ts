import { HardhatNetwork } from "../src/network";
import { NomadEnv } from "../src/nomadenv";
import { Key } from "../src/keys/key";
import type { TokenIdentifier } from "@nomad-xyz/sdk-bridge";
// import fs from "fs";
import { getCustomToken } from "./utils/token/deployERC20";
import { getRandomTokenAmount } from "../src/utils";
import { sendTokensAndConfirm } from "./common";
import bunyan from 'bunyan';
import { NomadDomain } from "../src/domain";

(async () => {

    // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
    const log = bunyan.createLogger({name: 'localenv'});

    // Instantiate HardhatNetworks
    const t = new HardhatNetwork('tom', 1);
    const j = new HardhatNetwork('jerry', 2);

    const sender = new Key();
    const receiver = new Key();

    t.addKeys(sender);
    j.addKeys(receiver);

    // Instantiate Nomad domains
    const tDomain = new NomadDomain(t);
    const jDomain = new NomadDomain(j);



    log.info(`Upped Tom and Jerry`);

    log.info(`Upped Tom and Jerry`);

    const le = new NomadEnv({domain: t.domainNumber, id: '0x'+'20'.repeat(20)});

    le.addDomain(tDomain);
    le.addDomain(jDomain);
    log.info(`Added Tom and Jerry`);

    // Set keys
    // le.setUpdater(new Key(`` + process.env.PRIVATE_KEY_1 + ``));
    // le.setWatcher(new Key(`` + process.env.PRIVATE_KEY_2 + ``));
    // le.setRelayer(new Key(`` + process.env.PRIVATE_KEY_3 + ``));
    // le.setKathy(new Key(`` + process.env.PRIVATE_KEY_4 + ``));
    // le.setProcessor(new Key(`` + process.env.PRIVATE_KEY_5 + ``));
    // le.setSigner(new Key(`` + process.env.PRIVATE_KEY_1 + ``));

    // t.setGovernanceAddresses(new Key(`` + process.env.PRIVATE_KEY_1 + ``)); // setGovernanceKeys should have the same PK as the signer keys
    // j.setGovernanceAddresses(new Key(`` + process.env.PRIVATE_KEY_1 + ``));

    // log.info(`Added Keys`)
    
    tDomain.connectNetwork(jDomain);
    jDomain.connectNetwork(tDomain);
    log.info(`Connected Tom and Jerry`);

    await le.upNetworks();
    log.info(`Upped Tom and Jerry`);

    // Notes, check governance router deployment on Jerry and see if that's actually even passing
    // ETHHelper deployment may be failing because of lack of governance router, either that or lack of wETH address.

    await Promise.all([
        t.setWETH(t.deployWETH()),
        j.setWETH(j.deployWETH())
    ])

    log.info(await le.deploy());

    // // let myContracts = le.deploymyproject();
    // await Promise.all([
    //   tDomain.upAllAgents(9080),
    //   jDomain.upAllAgents(9090),
    // ]);

    
    await le.upAgents()
    // await le.upAgents({kathy:false, watcher: false}) // warning: nokathy.
    

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

    // const tDomain = le.domain(t).name;
    
    const token: TokenIdentifier = {
      domain: tDomain.network.name,
      id: tokenOnTom.address,
    };

    console.log(`Tokenfactory, token deployed:`, tokenOnTom.address)

    const ctx = le.getBridgeSDK();
    console.log(`Initialized Bridge SDK context`)

    // Default multiprovider comes with signer (`o.setSigner(jerry, signer);`) assigned
    // to each domain, but we change it to allow sending from different signer
    ctx.registerWalletSigner(t.name, sender.toString());
    ctx.registerWalletSigner(j.name, receiver.toString());
    console.log(`registered wallet signers for tom and jerry`)

    // get 3 random amounts which will be bridged
    const amount1 = getRandomTokenAmount();
    const amount2 = getRandomTokenAmount();
    const amount3 = getRandomTokenAmount();

    console.log(`Phase 1 done`)


    await sendTokensAndConfirm(le, tDomain, jDomain, token, receiver.toAddress(), [
      amount1,
      amount2,
      amount3,
    ]);

    console.log(`Phase 2 done`)




    const tokenContract = await sendTokensAndConfirm(
      le,
      jDomain,
      tDomain,
      token,
      new Key().toAddress(),
      [amount3, amount2, amount1]
    );

      

    console.log(`Phase 3 done`)

    if (
      tokenContract.address.toLowerCase() !== token.id.toString().toLowerCase()
    ) {
      throw new Error(
        `Resolved asset at destination Jerry is not the same as the token. ${tokenContract.address.toLowerCase()} != ${token.id.toString().toLowerCase()}`
      );
    } else {
      console.log(`All cool!`)
    }

    success = true;
  } catch (e) {
    console.error(`Test failed:`, e);
  }

  // Teardown
  // await le.down();

  // await Promise.all([t.down(), j.down()]);

  if (!success) process.exit(1);

})();
