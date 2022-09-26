import { HardhatNetwork } from "../src/network";
import { NomadEnv } from "../src/nomadenv";
import { Key } from "../src/keys/key";
import bunyan from 'bunyan';
import { NomadDomain } from "../src/domain";

(async () => {

    // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
    const log = bunyan.createLogger({name: 'localenv'});

    // Instantiate HardhatNetworks

    // Instantiate Nomad domains
    const tDomain = new NomadDomain('tom',1);
    const jDomain = new NomadDomain('jerry',1);

    const sender = new Key();
    const receiver = new Key();

    tDomain.network.addKeys(sender);
    jDomain.network.addKeys(receiver);

    const le = new NomadEnv({domain: tDomain.network.domainNumber, id: '0x'+'20'.repeat(20)});

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
        tDomain.network.setWETH(await tDomain.network.deployWETH()),
        jDomain.network.setWETH(await jDomain.network.deployWETH()),
    ]);

    log.info(await le.deploy());

    // // let myContracts = le.deploymyproject();
    // await Promise.all([
    //   tDomain.upAllAgents(9080),
    //   jDomain.upAllAgents(9090),
    // ]);

    
    await le.upAgents();
    // await le.upAgents({kathy:false, watcher: false}) // warning: nokathy.
    

    log.info(`Agents up`);

})();
