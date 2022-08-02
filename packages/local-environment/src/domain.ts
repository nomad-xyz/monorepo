import { AgentConfig, LogConfig, BaseAgentConfig, NomadGasConfig, BridgeConfiguration, NetworkSpecs, ContractConfig } from "@nomad-xyz/configuration";
import { Key } from './key';
import { Network } from "./network";
import { Domain } from '@nomad-xyz/configuration'
import { Agents , LocalAgent } from "./agent";
import { ethers } from 'ethers';

// NomadDomain as a concept refers to settings, configs, and actors (agents, SDK) that are auxiliary to each arbitrary Network.

export class NomadDomain {
    agents?: Agents;
    keys: Key[];
    network: Network;
    signer: Key;
    updater: Key;
    watchers: Key[];
    relayer: Key;
    kathy: Key;
    processor: Key;

    connectedNetworks: NomadDomain[];
    
    constructor(network: Network, extraKeys?: Key[]) {
      this.signer = new Key(`` + process.env.PRIVATE_KEY_1 + ``);
      this.updater = new Key(`` + process.env.PRIVATE_KEY_1 + ``);
      this.watchers = [new Key(`` + process.env.PRIVATE_KEY_2 + ``)];
      this.relayer = new Key(`` + process.env.PRIVATE_KEY_3 + ``);
      this.kathy = new Key(`` + process.env.PRIVATE_KEY_4 + ``);
      this.processor = new Key(`` + process.env.PRIVATE_KEY_5 + ``);
      this.connectedNetworks = [];
      this.keys = [];
      this.network = network;
      if (extraKeys) {
        this.keys.push(...extraKeys)
      }

      this.setGovernanceAddresses(new Key(`` + process.env.PRIVATE_KEY_1 + ``), new Key(`` + process.env.PRIVATE_KEY_1 + ``), new Key(`` + process.env.PRIVATE_KEY_1 + ``))
    }

    connectNetwork(d: NomadDomain) {
      if (!this.connections().includes(d.network.name)) this.connectedNetworks.push(d);
    }

    get isAgentUp(): boolean {
      return !!this.agents;
    }

    networkJsonRpcSigner(addressOrIndex: string | number): ethers.providers.JsonRpcSigner {
      return this.network.getJsonRpcSigner(addressOrIndex);
    }

    networkJsonRpcProvider(): ethers.providers.JsonRpcProvider {
      return this.network.getJsonRpcProvider();
    }

    networkRpcs(): string[] {
      return this.network.rpcs;
    }

    watcherKeys(): Key[] {
      return this.watchers;
    }
  
  // Agent Key setting functions
  getAgentAddress(agent: LocalAgent): string {
    return agent.key.toAddress();
  }

  getAgentSigner(agent: LocalAgent): Key {
    return agent.key;
  }

  setAgentAddress(pk: string, agent: LocalAgent): void {
     const domain = this.network.domainNumber;
     if (domain) agent.key = new Key(pk);
  }

  //Used for governor settings on this.updater, this.watcher, this.recoveryManager
  setGovernanceAddresses(updaterKey?: Key, watcherKey?: Key, recoveryManagerKey?: Key) {
    this.network.updater = updaterKey!.toAddress();
    this.network.watcher = watcherKey!.toAddress();
    this.network.recoveryManager = recoveryManagerKey!.toAddress();
  }

  // Add arbitrary keys post deployment.
  addExtraKeys(...keys: Key[]) {
    this.keys.push(...keys);
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
