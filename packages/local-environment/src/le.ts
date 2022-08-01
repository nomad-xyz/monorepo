import { NomadLocator, NomadConfig, AgentConfig, LogConfig, BaseAgentConfig, NomadGasConfig, BridgeConfiguration, NetworkSpecs, ContractConfig} from "@nomad-xyz/configuration";
import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import * as dotenv from 'dotenv';
import { DeployContext } from "../../deploy/src/DeployContext";
import { HardhatNetwork } from "./network";
import * as ethers from 'ethers';
import { NonceManager } from "@ethersproject/experimental";
import fs from 'fs';
import bunyan from 'bunyan';
import { Key } from './key';
import { Domain } from '@nomad-xyz/configuration'
import { Agents , AgentType } from "./agent";

dotenv.config();

export class NomadEnv {
    domains: NomadDomain[];
    governor: NomadLocator;

    log = bunyan.createLogger({name: 'localenv'});

    multiprovider ?: BridgeContext; //@move to nomaddomain

    constructor(governor: NomadLocator) {
        this.domains = [];
        this.governor = governor;
    }

    // Adds a network to the array of networks if it's not already there.
    addDomain(d: NomadDomain) {
        if (!this.domains.includes(d)) this.domains.push(d);
    }
    
    // Gets governing network
    get govNetwork(): NomadDomain {
        const d = this.domains.find(d => d.domainNumber === this.governor.domain);
        if (!d) throw new Error(`Governing network is not present. GovDomain ${this.governor.domain}, present network domains: ${this.domains.map(d => d.domainNumber).join(', ')}`);
        return d;
    }
    
    getMultiprovider(): BridgeContext {
      if (!this.multiprovider) throw new Error(`No multiprovider`);
      return this.multiprovider;
    }

    async deployFresh(): Promise<void> {
        console.log(`Deploying!`, JSON.stringify(this.nomadConfig(), null, 4));

        const deployContext = this.setDeployContext();

        const outputDir = './output';
        const governanceBatch = await deployContext.deployAndRelinquish();
        console.log(`Deployed! gov batch:`, governanceBatch);
        await this.outputConfigAndVerification(outputDir, deployContext);
        await this.outputCallBatch(outputDir, deployContext);
    }

    async deploy(): Promise<void> {
        if (this.deployedOnce()) {

         //TODO: INPUT RESUME DEPLOYMENT LOGIC HERE

        } else {
                this.deployFresh()
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
        return false;
    }

    get deployerKey(): string {
        const DEPLOYERKEY = ``+ process.env.PRIVATE_KEY + ``;
        if (!DEPLOYERKEY) {
            throw new Error('Add DEPLOYER_PRIVATE_KEY to .env');
        }
        return DEPLOYERKEY;
    }

   getDomains(): NomadDomain[] {
        return Array.from(this.domains.values());
   }

   setDeployContext(): DeployContext {
        //@TODO remove re-initialization.
        const deployContext = new DeployContext(this.nomadConfig());
        // add deploy signer and overrides for each network
        for (const domain of this.domains) {
            const name = domain.name;
            const provider = deployContext.mustGetProvider(name);
            const wallet = new ethers.Wallet(this.deployerKey, provider);
            const signer = new NonceManager(wallet);
            deployContext.registerSigner(name, signer);
            deployContext.overrides.set(name, domain.deployOverrides);
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
            networks: this.domains.map(d => d.name),
            rpcs: Object.fromEntries(this.domains.map(d => [d.name, d.rpcs])),
            agent: Object.fromEntries(this.domains.map(d => [d.name, d.agentConfig])),
            protocol: {governor: this.governor, networks: Object.fromEntries(this.domains.map(d => [d.name, d.domain]))},
            core: Object.fromEntries(this.domains.filter(d => d.isDeployed).map(d => [d.name, d.coreContracts!])),
            bridge: Object.fromEntries(this.domains.filter(d => d.isDeployed).map(d => [d.name, d.bridgeContracts!])),
            bridgeGui: Object.fromEntries(this.domains.filter(d => d.isDeployed).map(d => [d.name, d.bridgeGui!])),
            gas: Object.fromEntries(this.domains.map(d => [d.name, d.gasConfig!])),
        }
    }
}

export class NomadDomain extends HardhatNetwork {
    agents?: Agents;
    signers: Map<number | string, Key>;
    updaters: Map<number | string, Key>;
    watchers: Map<number | string, Key>;
    relayers: Map<number | string, Key>;
    kathys: Map<number | string, Key>;
    processors: Map<number | string, Key>;

    connectedNetworks: NomadDomain[];

    //TODO: This should be arbitrary across all networks
    gasConfig: NomadGasConfig;
    
    constructor(name: string, domainNumber: number, chainId?: number) {
      super(name, domainNumber, chainId);
      this.signers = new Map();
      this.updaters = new Map();
      this.watchers = new Map();
      this.relayers = new Map();
      this.kathys = new Map();
      this.processors = new Map();
      this.connectedNetworks = [];
      this.keys = [];

      try {
        this.gasConfig = {
          core: {
            home: {
              update: {
                base: 100000,
                perMessage: 10000
              },
              improperUpdate: {
                base: 100000,
                perMessage: 10000
              },
              doubleUpdate: 200000
            },
            replica: {
              update: 140000,
              prove: 200000,
              process: 1700000,
              proveAndProcess: 1900000,
              doubleUpdate: 200000
            },
            connectionManager: {
              ownerUnenrollReplica: 120000,
              unenrollReplica: 120000
            }
          },
          bridge: {
            bridgeRouter: {
              send: 500000
            },
            ethHelper: {
              send: 800000,
              sendToEvmLike: 800000
            }
          }
        }
      } catch(e) {
        console.log(e)
      }
  
      this.gasConfig = {
        core: {
          home: {
            update: {
              base: 100000,
              perMessage: 10000
            },
            improperUpdate: {
              base: 100000,
              perMessage: 10000
            },
            doubleUpdate: 200000
          },
          replica: {
            update: 140000,
            prove: 200000,
            process: 1700000,
            proveAndProcess: 1900000,
            doubleUpdate: 200000
          },
          connectionManager: {
            ownerUnenrollReplica: 120000,
            unenrollReplica: 120000
          }
        },
        bridge: {
          bridgeRouter: {
            send: 500000
          },
          ethHelper: {
            send: 800000,
            sendToEvmLike: 800000
          }
        }
      }
    }

    connectNetwork(d: NomadDomain) {
      if (!this.connections().includes(d.name)) this.connectedNetworks.push(d);
    }

    get isAgentUp(): boolean {
      return !!this.agents;
    }

    getSignerKey(
      agentType?: string | AgentType
    ): Key | undefined {
      const domain = this.domainNumber;
      if (domain) {
        if (agentType) {
          const mapKey = `agentType_${domain}`;
          return this.signers.get(mapKey);
        } else {
          return this.signers.get(this.domainNumber);
        }
      }
      return undefined;
    }
 
    getUpdaterKey(): Key | undefined {
      const domain = this.domainNumber;
      if (domain) {
        return this.updaters.get(this.domainNumber);
      }
      return undefined;
    }
 
    getWatcherKey(): Key | undefined {
      const domain = this.domainNumber;
      if (domain) return this.watchers.get(this.domainNumber);
      return undefined;
    }

    getKathyKey(): Key | undefined {
      const domain = this.domainNumber;
      if (domain) return this.kathys.get(this.domainNumber);
      return undefined;
    }
    getProcessorKey(): Key | undefined {
      const domain = this.domainNumber;
      if (domain) return this.processors.get(this.domainNumber);
      return undefined;
    }
    getRelayerKey(): Key | undefined {
      const domain = this.domainNumber;
      if (domain) return this.relayers.get(this.domainNumber);
      return undefined;
    }

   // Sets keys for each agent across all Nomad networks.
   setUpdater(key: Key) {
    const domain = this.domainNumber;
    if (domain) this.updaters.set(this.domainNumber, key);
   }

   setWatcher(key: Key) {
    const domain = this.domainNumber;
    if (domain) this.watchers.set(this.domainNumber, key);
   }

   setKathy(key: Key) {
    const domain = this.domainNumber;
    if (domain) this.kathys.set(this.domainNumber, key);
   }

   setProcessor(key: Key) {
    const domain = this.domainNumber;
    if (domain) this.processors.set(this.domainNumber, key);
   }

   setRelayer(key: Key) {
    const domain = this.domainNumber;
    if (domain) this.relayers.set(this.domainNumber, key);
   }

   setSigner(key: Key, agentType?: string | AgentType) {
     const domain = this.domainNumber;

     if (domain) {
       if (agentType) {
         const mapKey = `${agentType}_${domain}`;
         this.signers.set(mapKey, key);
       } else {
         this.signers.set(this.domainNumber, key);
       }
     }
  }   

  async upAgents(d: NomadDomain, env: NomadEnv, metricsPort: number) {
      this.agents = new Agents(d, env, metricsPort);
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

  async stopAgents() {
    this.agents!.relayer.stop();
    this.agents!.updater.stop();
    this.agents!.processor.stop();
    this.agents!.kathy.stop();
    for (const watcher of this.agents!.watchers) {
      watcher.stop();
    }
  }

  connections(): string[] {
    return this.connectedNetworks.map(d => d.name);
  }

  get domain(): Domain {
    return {
        name: this.name,
        domain: this.domainNumber,
        connections: this.connections(),
        specs: this.specs,
        configuration: this.config,
        bridgeConfiguration: this.bridgeConfig,
    }
  }

  get agentConfig(): AgentConfig {
    return{ 
        rpcStyle: "ethereum",
        metrics: 9090,
        db: "/app",
        logging: this.logConfig,
        updater: this.updaterConfig,
        relayer: this.relayerConfig,
        processor: this.processorConfig,
        watcher: this.watcherConfig,
        kathy: this.kathyConfig
    } as unknown as AgentConfig
}

  get logConfig(): LogConfig {
      return {
        fmt: "json",
        level: "info"
      }
  }

  get updaterConfig(): BaseAgentConfig {
      return { 
        "enabled": true,
        "interval": 5
      }
  }

  get watcherConfig(): BaseAgentConfig {
      return { 
        "enabled": true,
        "interval": 5
      }
  }

  get relayerConfig(): BaseAgentConfig {
      return { 
        "enabled": true,
        "interval": 10
      }
  }

  get processorConfig(): BaseAgentConfig {
      return { 
        "enabled": true,
        "interval": 5,
      subsidizedRemotes: [
        "tom", 
        "jerry"
      ]
    } as BaseAgentConfig
}

  get kathyConfig(): BaseAgentConfig {
      return { 
        "enabled": true,
        "interval": 500
      }
  }

  get bridgeConfig(): BridgeConfiguration {
    return {
        weth: this.weth,
        customs: [],
        mintGas: 200000,
        deployGas: 850000
      }
  }

  get specs(): NetworkSpecs {
    return {
        chainId: this.chainId,
        finalizationBlocks: 2,
        blockTime: this.blockTime,
        supports1559: true,
        confirmations: 2,
        blockExplorer: '',
        indexPageSize: 2000,
      }
  }

  get config(): ContractConfig {
    return {
        optimisticSeconds: 18,
        processGas: 850000,
        reserveGas: 25000,
        maximumGas: 1000000,
        governance: {
            recoveryManager: this.recoveryManager,
            recoveryTimelock: 86400
        },
        updater: this.updater,
        watchers: [this.watcher]
      }
    }

  get rpcs(): string[] {
      return [`http://localhost:${this.handler.port}`];
  }

}

(async () => {

    // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
    const log = bunyan.createLogger({name: 'localenv'});

    const t = new NomadDomain('tom', 1);

    const j = new NomadDomain('jerry', 2);

    await Promise.all([
        t.up(),
        j.up(),
    ])

    log.info(`Upped Tom and Jerry`);

    const le = new NomadEnv({domain: t.domainNumber, id: '0x'+'20'.repeat(20)});

    le.addDomain(t);
    le.addDomain(j);
    log.info(`Added Tom and Jerry`);

    // Set keys
    t.setUpdater(new Key(`` + process.env.PRIVATE_KEY_1 + ``));
    t.setWatcher(new Key(`` + process.env.PRIVATE_KEY_2 + ``));
    t.setRelayer(new Key(`` + process.env.PRIVATE_KEY_3 + ``));
    t.setKathy(new Key(`` + process.env.PRIVATE_KEY_4 + ``));
    t.setProcessor(new Key(`` + process.env.PRIVATE_KEY_5 + ``));
    t.setSigner(new Key(`` + process.env.PRIVATE_KEY_1 + ``));

    j.setUpdater(new Key(`` + process.env.PRIVATE_KEY_1 + ``));
    j.setWatcher(new Key(`` + process.env.PRIVATE_KEY_2 + ``));
    j.setRelayer(new Key(`` + process.env.PRIVATE_KEY_3 + ``));
    j.setKathy(new Key(`` + process.env.PRIVATE_KEY_4 + ``));
    j.setProcessor(new Key(`` + process.env.PRIVATE_KEY_5 + ``));
    j.setSigner(new Key(`` + process.env.PRIVATE_KEY_1 + ``));

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

    await t.upAgents(t, le, 9080);
    await j.upAgents(j, le, 9090);
    log.info(`Agents up`);

})()