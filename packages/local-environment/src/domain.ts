import { AgentConfig, LogConfig, BaseAgentConfig, NomadGasConfig, BridgeConfiguration, NetworkSpecs, ContractConfig } from "@nomad-xyz/configuration";
import { Key } from './key';
import { Network } from "./network";
import { Domain } from '@nomad-xyz/configuration'
import { Agents , AgentType } from "./agent";
import { BridgeContext } from '@nomad-xyz/sdk-bridge';

// NomadDomain as a concept refers to settings, configs, and actors (agents, SDK) that are auxiliary to each arbitrary Network.
export class NomadDomain {
    agents?: Agents;
    sdk?: BridgeContext;
    network: Network;
    signers: Map<number | string, Key>;
    updaters: Map<number | string, Key>;
    watchers: Map<number | string, Key>;
    relayers: Map<number | string, Key>;
    kathys: Map<number | string, Key>;
    processors: Map<number | string, Key>;

    connectedNetworks: NomadDomain[];

    //TODO: This should be arbitrary across all networks
    
    constructor(network: Network) {
      this.signers = new Map();
      this.updaters = new Map();
      this.watchers = new Map();
      this.relayers = new Map();
      this.kathys = new Map();
      this.processors = new Map();
      this.connectedNetworks = [];
      this.network = network;

    }

    connectNetwork(d: NomadDomain) {
      if (!this.connections().includes(d.network.name)) this.connectedNetworks.push(d);
    }

    get isAgentUp(): boolean {
      return !!this.agents;
    }

    getSDK(): BridgeContext {
        if (!this.sdk) throw new Error(`No multiprovider`);
        return this.sdk;
    }

    getSignerKey(
      agentType?: string | AgentType
    ): Key | undefined {
      const domain = this.network.domainNumber;
      if (domain) {
        if (agentType) {
          const mapKey = `agentType_${domain}`;
          return this.signers.get(mapKey);
        } else {
          return this.signers.get(this.network.domainNumber);
        }
      }
      return undefined;
    }
 
    getUpdaterKey(): Key | undefined {
      const domain = this.network.domainNumber;
      if (domain) {
        return this.updaters.get(this.network.domainNumber);
      }
      return undefined;
    }
 
    getWatcherKey(): Key | undefined {
      const domain = this.network.domainNumber;
      if (domain) return this.watchers.get(this.network.domainNumber);
      return undefined;
    }

    getKathyKey(): Key | undefined {
      const domain = this.network.domainNumber;
      if (domain) return this.kathys.get(this.network.domainNumber);
      return undefined;
    }
    getProcessorKey(): Key | undefined {
      const domain = this.network.domainNumber;
      if (domain) return this.processors.get(this.network.domainNumber);
      return undefined;
    }
    getRelayerKey(): Key | undefined {
      const domain = this.network.domainNumber;
      if (domain) return this.relayers.get(this.network.domainNumber);
      return undefined;
    }

   // Sets keys for each agent across all Nomad networks.
   setUpdater(key: Key) {
    const domain = this.network.domainNumber;
    if (domain) this.updaters.set(this.network.domainNumber, key);
   }

   setWatcher(key: Key) {
    const domain = this.network.domainNumber;
    if (domain) this.watchers.set(this.network.domainNumber, key);
   }

   setKathy(key: Key) {
    const domain = this.network.domainNumber;
    if (domain) this.kathys.set(this.network.domainNumber, key);
   }

   setProcessor(key: Key) {
    const domain = this.network.domainNumber;
    if (domain) this.processors.set(this.network.domainNumber, key);
   }

   setRelayer(key: Key) {
    const domain = this.network.domainNumber;
    if (domain) this.relayers.set(this.network.domainNumber, key);
   }

   setSigner(key: Key, agentType?: string | AgentType) {
     const domain = this.network.domainNumber;

     if (domain) {
       if (agentType) {
         const mapKey = `${agentType}_${domain}`;
         this.signers.set(mapKey, key);
       } else {
         this.signers.set(this.network.domainNumber, key);
       }
     }
  }   

    //Used for governor settings on this.updater, this.watcher, this.recoveryManager
    setGovernanceAddresses(key: Key) {
      this.network.updater = key.toAddress();
      this.network.watcher = key.toAddress();
      this.network.recoveryManager = key.toAddress();
    }

  connections(): string[] {
    return this.connectedNetworks.map(d => d.network.name);
  }

  get domain(): Domain {
    return {
        name: this.network.name,
        domain: this.network.domainNumber,
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
        weth: this.network.weth,
        customs: [],
        mintGas: 200000,
        deployGas: 850000
      }
  }

  get specs(): NetworkSpecs {
    return {
        chainId: this.network.chainId,
        finalizationBlocks: 2,
        blockTime: this.network.handler.blockTime,
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
            recoveryManager: this.network.recoveryManager,
            recoveryTimelock: 86400
        },
        updater: this.network.updater,
        watchers: [this.network.watcher]
      }
    }

    get gasConfig(): NomadGasConfig {
        return {
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

  get rpcs(): string[] {
      return [`http://localhost:${this.network.handler.port}`];
  }

}
