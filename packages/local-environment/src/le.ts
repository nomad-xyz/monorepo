import { NomadLocator, NomadConfig } from "@nomad-xyz/configuration";
import * as dotenv from 'dotenv';
import { DeployContext } from "../../deploy/src/DeployContext";
import { HardhatNetwork, Network } from "./network";
import * as ethers from 'ethers';
import { NonceManager } from "@ethersproject/experimental";
import fs from 'fs';
import bunyan from 'bunyan';
import { Key } from './key';
import { Agents , AgentType } from "./agent";

dotenv.config();

export class NomadEnv {
    agents?: Agents;
    networks: Network[];
    governor: NomadLocator;
    log = bunyan.createLogger({name: 'localenv'});
    signers: Map<number | string, Key>;
    updaters: Map<number | string, Key>;
    watchers: Map<number | string, Key>;
    relayers: Map<number | string, Key>;
    kathys: Map<number | string, Key>;
    processors: Map<number | string, Key>;

    constructor(governor: NomadLocator) {
        this.networks = [];
        this.governor = governor;
        this.signers = new Map();
        this.updaters = new Map();
        this.watchers = new Map();
        this.relayers = new Map();
        this.kathys = new Map();
        this.processors = new Map();
    }

    get isAgentUp(): boolean {
      return !!this.agents
    }

    getSignerKey(
      network: Network,
      agentType?: string | AgentType
    ): Key | undefined {
      const domain = network.domainNumber;
      if (domain) {
        if (agentType) {
          const mapKey = `agentType_${domain}`;
          return this.signers.get(mapKey);
        } else {
          return this.signers.get(network.domainNumber);
        }
      }
      return undefined;
    }
 
    getUpdaterKey(network: Network): Key | undefined {
      const domain = network.domainNumber;
      if (domain) {
        return this.updaters.get(network.domainNumber);
      }
      return undefined;
    }
 
    getWatcherKey(network: Network): Key | undefined {
      const domain = network.domainNumber;
      if (domain) return this.watchers.get(network.domainNumber);
      return undefined;
    }

    getKathyKey(network: Network): Key | undefined {
      const domain = network.domainNumber;
      if (domain) return this.kathys.get(network.domainNumber);
      return undefined;
    }
    getProcessorKey(network: Network): Key | undefined {
      const domain = network.domainNumber;
      if (domain) return this.processors.get(network.domainNumber);
      return undefined;
    }
    getRelayerKey(network: Network): Key | undefined {
      const domain = network.domainNumber;
      if (domain) return this.relayers.get(network.domainNumber);
      return undefined;
    }

   // Sets keys for each agent across all Nomad networks.
   setUpdater(key: Key) {
    for (const network of this.networks) {
      const domain = network.domainNumber;
      if (domain) this.updaters.set(network.domainNumber, key);
    }
   }

   setWatcher(key: Key) {
    for (const network of this.networks) {
      const domain = network.domainNumber;
      if (domain) this.watchers.set(network.domainNumber, key);
    }
   }

   setKathy(key: Key) {
    for (const network of this.networks) {
      const domain = network.domainNumber;
      if (domain) this.kathys.set(network.domainNumber, key);
    }
   }

   setProcessor(key: Key) {
    for (const network of this.networks) {
      const domain = network.domainNumber;
      if (domain) this.processors.set(network.domainNumber, key);
    }
   }

   setRelayer(key: Key) {
    for (const network of this.networks) {
      const domain = network.domainNumber;
      if (domain) this.relayers.set(network.domainNumber, key);
    }
   }

   setSigner(key: Key, agentType?: string | AgentType) {
    for (const network of this.networks) {
     const domain = network.domainNumber;

     if (domain) {
       if (agentType) {
         const mapKey = `${agentType}_${domain}`;
         this.signers.set(mapKey, key);
       } else {
         this.signers.set(network.domainNumber, key);
       }
     }
    }
  }   

  async upAgents(n: Network, env: NomadEnv, metricsPort: number) {
      this.agents = new Agents(n, env, metricsPort);
      await this.agents.relayer.connect();
      this.agents.relayer.start();
      await this.agents.updater.connect();
      this.agents.updater.start();
      await this.agents.processor.connect();
      this.agents.processor.start();
      await this.agents.kathy.connect();
      this.agents.kathy.start();
      for (const watcher of this.agents.watchers) {
        await watcher.connect();
        watcher.start();
      }
  }

    // Adds a network to the array of networks if it's not already there.
    addNetwork(n: Network) {
        if (!this.networks.includes(n)) this.networks.push(n);
    }
    
    // Gets governing network
    get govNetwork(): Network {
        const n = this.networks.find(n => n.domainNumber === this.governor.domain);
        if (!n) throw new Error(`Governing network is not present. GovDomain ${this.governor.domain}, present network domains: ${this.networks.map(n => n.domainNumber).join(', ')}`);
        return n;
    }

    async deployFresh(): Promise<void> {
        console.log(`Deploying!`, JSON.stringify(this.nomadConfig(), null, 4));

        const outputDir = './output';
        const governanceBatch = await this.deployContext.deployAndRelinquish();
        console.log(`Deployed! gov batch:`, governanceBatch);
        
        fs.mkdirSync(outputDir, {recursive: true});
        fs.writeFileSync(
            `${outputDir}/test_config.json`,
            JSON.stringify(this.deployContext.data, null, 2),
        );
        // if new contracts were deployed,
        const verification = Object.fromEntries(this.deployContext.verification);
        if (Object.keys(verification).length > 0) {
          // output the verification inputs
          fs.writeFileSync(
              `${outputDir}/verification-${Date.now()}.json`,
              JSON.stringify(verification, null, 2),
          );
        }
    }

    async deploy(): Promise<void> {
        if (this.deployedOnce()) {

        console.log(`Deploying!`, JSON.stringify(this.nomadConfig(), null, 4));

        const deployContext = this.setDeployContext();

        const outputDir = './output';
        const governanceBatch = await deployContext.deployAndRelinquish();
        console.log(`Deployed! gov batch:`, governanceBatch);
        await this.outputConfigAndVerification(outputDir, deployContext);
        await this.outputCallBatch(outputDir, deployContext);
        } else {
                this.deployFresh()
                return
        }
    }

    outputConfigAndVerification(outputDir: string, deployContext: DeployContext) {
        // output the config
        fs.mkdirSync(outputDir, {recursive: true});
        fs.writeFileSync(
            `${outputDir}/test_config.json`,
            JSON.stringify(deployContext.data, null, 2),
        );
        // if new contracts were deployed,
        const verification = Object.fromEntries(deployContext.verification);
        if (Object.keys(verification).length > 0) {
          // output the verification inputs
          fs.writeFileSync(
              `${outputDir}/verification-${Date.now()}.json`,
              JSON.stringify(verification, null, 2),
          );
        }
    }

    async outputCallBatch(outputDir: string, deployContext: DeployContext) {
        const governanceBatch = deployContext.callBatch;
        if (!governanceBatch.isEmpty()) {
          // build & write governance batch
          await governanceBatch.build();
          fs.writeFileSync(
              `${outputDir}/governanceTransactions.json`,
              JSON.stringify(governanceBatch, null, 2),
          );
        }
      }

    async check(): Promise<void> {
        await this.deployContext.checkDeployment();
        console.log(`CHECKS PASS!`);
    }

    //@TODO Feature: switches after contracts exist
    deployedOnce(): boolean {
        return true;
    }

    get deployerKey(): string {
        const DEPLOYERKEY = ``+ process.env.PRIVATE_KEY + ``;
        if (!DEPLOYERKEY) {
            throw new Error('Add DEPLOYER_PRIVATE_KEY to .env');
        }
        return DEPLOYERKEY;
    }

    getNetworks(): Network[] {
        return Array.from(this.networks.values());
   }

    setDeployContext(): DeployContext {
        //@TODO remove re-initialization.
        const deployContext = new DeployContext(this.nomadConfig());
        // add deploy signer and overrides for each network
        for (const network of this.networks) {
            const name = network.name;
            const provider = deployContext.mustGetProvider(name);
            const wallet = new ethers.Wallet(this.deployerKey, provider);
            const signer = new NonceManager(wallet);
            deployContext.registerSigner(name, signer);
            deployContext.overrides.set(name, network.deployOverrides);
        }
        return deployContext;
    }

    get deployContext(): DeployContext{
        return this.deployContext;
    }

    nomadConfig(): NomadConfig {
        return {
            version: 0,
            environment: 'local',
            networks: this.networks.map(n => n.name),
            rpcs: Object.fromEntries(this.networks.map(n => [n.name, n.rpcs])),
            agent: Object.fromEntries(this.networks.map(n => [n.name, n.agentConfig])),
            protocol: {governor: this.governor, networks: Object.fromEntries(this.networks.map(n => [n.name, n.domain]))},
            core: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.coreContracts!])),
            bridge: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.bridgeContracts!])),
            bridgeGui: Object.fromEntries(this.networks.filter(n => n.isDeployed).map(n => [n.name, n.bridgeGui!])),
            gas: Object.fromEntries(this.networks.map(n => [n.name, n.gasConfig!])),
        }
    }
}

(async () => {

    // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
    const log = bunyan.createLogger({name: 'localenv'});

    const t = new HardhatNetwork('tom', 1, []);

    const j = new HardhatNetwork('jerry', 2, []);

    await Promise.all([
        t.up(),
        j.up(),
    ])

    log.info(`Upped Tom and Jerry`);

    const le = new NomadEnv({domain: t.domainNumber, id: '0x'+'20'.repeat(20)});

    le.addNetwork(t);
    le.addNetwork(j);
    log.info(`Added Tom and Jerry`);

    // Set keys
    le.setUpdater(new Key(`` + process.env.PRIVATE_KEY_1 + ``));
    le.setWatcher(new Key(`` + process.env.PRIVATE_KEY_2 + ``));
    le.setRelayer(new Key(`` + process.env.PRIVATE_KEY_3 + ``));
    le.setKathy(new Key(`` + process.env.PRIVATE_KEY_4 + ``));
    le.setProcessor(new Key(`` + process.env.PRIVATE_KEY_5 + ``));
    le.setSigner(new Key(`` + process.env.PRIVATE_KEY_1 + ``));

    t.setGovernanceAddresses(new Key(`` + process.env.PRIVATE_KEY_1 + ``)); // setGovernanceKeys should have the same PK as the signer keys
    j.setGovernanceAddresses(new Key(`` + process.env.PRIVATE_KEY_1 + ``));

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

    await le.upAgents(t, le, 9080);
    await le.upAgents(j, le, 9090);
    log.info(`Agents up`);

})()