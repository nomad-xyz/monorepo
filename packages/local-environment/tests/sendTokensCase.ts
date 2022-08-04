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
    t.addKeys(receiver);

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

    
    await le.upAgents() // warning: nokathy.
    // await le.upAgents({kathy:false, watcher: false}) // warning: nokathy.
    

    log.info(`Agents up`);

    

  // fs.writeFileSync("/tmp/nomad.json", JSON.stringify(n.toObject()));

  // Scenario

  // stopper
  console.log(`Starting to wait`)
  await new Promise((resolve, reject) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    readline.question(`What's your name?`,( name: string) => {
      console.log(`Hi ${name}!`);
      resolve(true)
      readline.close();
    });
  })
  console.log(`Awaited`)

  /*

{"timestamp":"2022-08-04T18:28:09.494082Z","level":"INFO","fields":{"message":"No produced update to submit for committed_root.","committed_root":"0x0000000000000000000000000000000000000000000000000000000000000000"},"target":"updater::submit"}
{"timestamp":"2022-08-04T18:28:10.345618Z","level":"INFO","fields":{"message":"No updates to sign. Waiting for new root building off of current root 0x0000000000000000000000000000000000000000000000000000000000000000."},"target":"updater::produce"}
{"timestamp":"2022-08-04T18:28:14.496438Z","level":"INFO","fields":{"message":"No produced update to submit for committed_root.","committed_root":"0x0000000000000000000000000000000000000000000000000000000000000000"},"target":"updater::submit"}
{"timestamp":"2022-08-04T18:28:15.379967Z","level":"INFO","fields":{"message":"No updates to sign. Waiting for new root building off of current root 0x0000000000000000000000000000000000000000000000000000000000000000."},"target":"updater::produce"}
{"timestamp":"2022-08-04T18:28:19.500297Z","level":"INFO","fields":{"message":"No produced update to submit for committed_root.","committed_root":"0x0000000000000000000000000000000000000000000000000000000000000000"},"target":"updater::submit"}
{"timestamp":"2022-08-04T18:28:20.419136Z","level":"INFO","fields":{"message":"No updates to sign. Waiting for new root building off of current root 0x0000000000000000000000000000000000000000000000000000000000000000."},"target":"updater::produce"}
{"timestamp":"2022-08-04T18:28:24.497739Z","level":"INFO","fields":{"message":"No produced update to submit for committed_root.","committed_root":"0x0000000000000000000000000000000000000000000000000000000000000000"},"target":"updater::submit"}
{"timestamp":"2022-08-04T18:28:25.456688Z","level":"INFO","fields":{"message":"No updates to sign. Waiting for new root building off of current root 0x0000000000000000000000000000000000000000000000000000000000000000."},"target":"updater::produce"}
{"timestamp":"2022-08-04T18:28:29.508127Z","level":"INFO","fields":{"message":"No produced update to submit for committed_root.","committed_root":"0x0000000000000000000000000000000000000000000000000000000000000000"},"target":"updater::submit"}
{"timestamp":"2022-08-04T18:28:30.500689Z","level":"INFO","fields":{"message":"Storing new update in DB for broadcast","previous_root":"0x0000000000000000000000000000000000000000000000000000000000000000","new_root":"0x030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd2","hex_signature":"0xd8a3d4e7bfc24b376c2aa31d46ffd3150fc4d25c92164fa0ecba1a9f79d3cd8643fd1d4592e3fc330c557205312f65c3821b16b57db4d8a0b3bc049ea3e2058b1b"},"target":"updater::produce"}
{"timestamp":"2022-08-04T18:28:34.511915Z","level":"INFO","fields":{"message":"Submitting update to chain","previous_root":"0x0000000000000000000000000000000000000000000000000000000000000000","new_root":"0x030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd2","hex_signature":"0xd8a3d4e7bfc24b376c2aa31d46ffd3150fc4d25c92164fa0ecba1a9f79d3cd8643fd1d4592e3fc330c557205312f65c3821b16b57db4d8a0b3bc049ea3e2058b1b"},"target":"updater::submit"}
{"timestamp":"2022-08-04T18:28:34.522433Z","level":"INFO","fields":{"message":"Dispatching transaction","to":"Address(0xdaefe73ee4405b27e684cf1e963326d2bb59bc32)","data":"0xb31c01fb0000000000000000000000000000000000000000000000000000000000000000030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000041d8a3d4e7bfc24b376c2aa31d46ffd3150fc4d25c92164fa0ecba1a9f79d3cd8643fd1d4592e3fc330c557205312f65c3821b16b57db4d8a0b3bc049ea3e2058b1b00000000000000000000000000000000000000000000000000000000000000"},"target":"nomad_ethereum::submitter","span":{"update":"SignedUpdate { Update { home_domain: 1, previous_root: 0x0000000000000000000000000000000000000000000000000000000000000000, new_root: 0x030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd2 } Signature: 0xd8a3d4e7bfc24b376c2aa31d46ffd3150fc4d25c92164fa0ecba1a9f79d3cd8643fd1d4592e3fc330c557205312f65c3821b16b57db4d8a0b3bc049ea3e2058b1b  }","name":"update"},"spans":[{"update":"SignedUpdate { Update { home_domain: 1, previous_root: 0x0000000000000000000000000000000000000000000000000000000000000000, new_root: 0x030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd2 } Signature: 0xd8a3d4e7bfc24b376c2aa31d46ffd3150fc4d25c92164fa0ecba1a9f79d3cd8643fd1d4592e3fc330c557205312f65c3821b16b57db4d8a0b3bc049ea3e2058b1b  }","name":"update"}]}
{"timestamp":"2022-08-04T18:28:40.588908Z","level":"INFO","fields":{"message":"No updates to sign. Waiting for new root building off of current root 0x030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd2."},"target":"updater::produce"}
{"timestamp":"2022-08-04T18:28:41.572596Z","level":"INFO","fields":{"message":"Confirmed transaction","tx_hash":"0xc5ea22140d7ffc818ce50ca16c9416fb30c01bfe2a43934b64cee0ecf304471c"},"target":"nomad_ethereum::submitter","span":{"update":"SignedUpdate { Update { home_domain: 1, previous_root: 0x0000000000000000000000000000000000000000000000000000000000000000, new_root: 0x030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd2 } Signature: 0xd8a3d4e7bfc24b376c2aa31d46ffd3150fc4d25c92164fa0ecba1a9f79d3cd8643fd1d4592e3fc330c557205312f65c3821b16b57db4d8a0b3bc049ea3e2058b1b  }","name":"update"},"spans":[{"update":"SignedUpdate { Update { home_domain: 1, previous_root: 0x0000000000000000000000000000000000000000000000000000000000000000, new_root: 0x030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd2 } Signature: 0xd8a3d4e7bfc24b376c2aa31d46ffd3150fc4d25c92164fa0ecba1a9f79d3cd8643fd1d4592e3fc330c557205312f65c3821b16b57db4d8a0b3bc049ea3e2058b1b  }","name":"update"}]}
{"timestamp":"2022-08-04T18:28:41.574522Z","level":"INFO","fields":{"message":"Submitted update with tx hash 0xc5ea22140d7ffc818ce50ca16c9416fb30c01bfe2a43934b64cee0ecf304471c. Sleeping before next tx submission.","tx_hash":"0xc5ea22140d7ffc818ce50ca16c9416fb30c01bfe2a43934b64cee0ecf304471c","sleep":10},"target":"updater::submit"}
{"timestamp":"2022-08-04T18:28:45.635503Z","level":"INFO","fields":{"message":"No updates to sign. Waiting for new root building off of current root 0x030026068ae264babb866dc4c2b247eceaee25caa3152ddf98f127149545ebd2."},"target":"updater::produce"}


  */


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

    console.log(`kkeeeeeeek--->`)
    const ctx = le.getBridgeSDK();
    console.log(`loooooooll--->`)

    // Default multiprovider comes with signer (`o.setSigner(jerry, signer);`) assigned
    // to each domain, but we change it to allow sending from different signer
    ctx.registerWalletSigner(t.name, sender.toString());
    ctx.registerWalletSigner(j.name, receiver.toString());
    console.log(`fooooo--->`)

    // get 3 random amounts which will be bridged
    const amount1 = getRandomTokenAmount();
    const amount2 = getRandomTokenAmount();
    const amount3 = getRandomTokenAmount();

    console.log(`bazz 1--->`)


    await sendTokensAndConfirm(le, tDomain, jDomain, token, receiver.toAddress(), [
      amount1,
      amount2,
      amount3,
    ]);

    console.log(`bazz 2--->`)


    const tokenContract = await sendTokensAndConfirm(
      le,
      tDomain,
      jDomain,
      token,
      new Key().toAddress(),
      [amount3, amount2, amount1]
    );

    console.log(`bazz 3--->`)

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
  await le.down();

  await Promise.all([t.down(), j.down()]);

  if (!success) process.exit(1);

})();
