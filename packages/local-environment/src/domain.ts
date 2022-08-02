import { AgentConfig, LogConfig, BaseAgentConfig, NomadGasConfig, BridgeConfiguration, NetworkSpecs, ContractConfig} from "@nomad-xyz/configuration";
import { Key } from './key';
import { HardhatNetwork, Network } from "./network";
import { Domain } from '@nomad-xyz/configuration'
import { Agents , AgentType } from "./agent";

export class NomadDomain extends HardhatNetwork {
    agents?: Agents;
    network?: Network;
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
