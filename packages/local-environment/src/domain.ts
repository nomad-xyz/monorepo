import {
  AgentConfig,
  LogConfig,
  BaseAgentConfig,
  NomadGasConfig,
  BridgeConfiguration,
  NetworkSpecs,
  ContractConfig,
  ProcessorConfig,
} from "@nomad-xyz/configuration";
import { Key } from "./keys/key";
import { HardhatNetwork, Network } from "./network";
import { Domain } from "@nomad-xyz/configuration";
import { Agents, AgentType } from "./agent";
import { ethers } from "ethers";
import { AgentKeys } from "./keys/index";

// NomadDomain as a concept refers to settings, configs, and actors (agents, SDK) that are auxiliary to each arbitrary Network.

export class NomadDomain {
  agents?: Agents;
  keys: AgentKeys;
  network: Network;
  metricsPort?: number;

  connectedNetworks: NomadDomain[];

  constructor(network: Network, extraKeys?: Key[]) {
    this.connectedNetworks = [];
    this.keys = new AgentKeys();
    this.network = network;

    const signer = this.keys.getAgentKey("signer");

    this.setGovernanceAddresses({
      updater: signer,
      watcher: signer,
      recoveryManager: signer,
    });
  }

  get name(): string {
    return this.network.name;
  }

  ensureAgents(metricsPort = 9090) {
    if (!this.agents) this.agents = new Agents(this, metricsPort);
  }

  connectNetwork(d: NomadDomain) {
    if (!this.connections().includes(d.network.name))
      this.connectedNetworks.push(d);
  }

  get isAgentUp(): boolean {
    return !!this.agents;
  }

  networkJsonRpcSigner(
    addressOrIndex: string | number
  ): ethers.providers.JsonRpcSigner {
    return this.network.getJsonRpcSigner(addressOrIndex);
  }

  networkJsonRpcProvider(): ethers.providers.JsonRpcProvider {
    return this.network.getJsonRpcProvider();
  }

  networkRpcs(): string[] {
    return this.network.rpcs;
  }

  watcherKeys(): Key[] {
    return this.keys.watchers;
  }

  // Agent Key setting functions
  getAgentAddress(type: AgentType, watcherNumber = 0): string {
    return this.keys.getAgentAddress(type, watcherNumber);
  }

  getAgentSigner(type?: AgentType, watcherNumber = 0): Key {
    if (type) return this.keys.getAgentKey(type, watcherNumber);
    return this.keys.getAgentKey(type, watcherNumber);
  }

  //Used for governor settings on this.updater, this.watcher, this.recoveryManager
  setGovernanceAddresses(a: {
    updater?: Key;
    watcher?: Key;
    recoveryManager?: Key;
  }) {
    if (a.updater) this.network.updater = a.updater.toAddress();
    if (a.watcher) this.network.watcher = a.watcher.toAddress();
    if (a.recoveryManager)
      this.network.recoveryManager = a.recoveryManager.toAddress();
  }

  connections(): string[] {
    return this.connectedNetworks.map((d) => d.network.name);
  }

  localNetEnsureKeys() {
    // TODO: this is not thought through. Docker nets should have keys beforehand
    (this.network as HardhatNetwork).addKeys(...this.keys.array);
  }

  async networkUp() {
    await this.localNetEnsureKeys();
    await this.network.up();
  }

  async agentsUp(metricsPort?: number, agentType?: string) {
    await this.ensureAgents(metricsPort);
    await this.agents!.upAll(agentType);
  }

  async up(metricsPort?: number, agentType?: string) {
    await this.networkUp();
    await this.agentsUp(metricsPort, agentType);
  }

  async down() {
    return await this.agents?.downAll();
  }

  get domain(): Domain {
    return {
      name: this.network.name,
      domain: this.network.domainNumber,
      connections: this.connections(),
      specs: this.specs,
      configuration: this.config,
      bridgeConfiguration: this.bridgeConfig,
    };
  }

  get agentConfig(): AgentConfig {
    return {
      rpcStyle: "ethereum",
      metrics: 9090,
      db: "/app",
      logging: this.logConfig,
      updater: this.updaterConfig,
      relayer: this.relayerConfig,
      processor: this.processorConfig,
      watcher: this.watcherConfig,
      kathy: this.kathyConfig,
    };
  }

  get logConfig(): LogConfig {
    return {
      fmt: "json",
      level: "info",
    };
  }

  get updaterConfig(): BaseAgentConfig {
    return {
      interval: 5,
    };
  }

  get watcherConfig(): BaseAgentConfig {
    return {
      interval: 5,
    };
  }

  get relayerConfig(): BaseAgentConfig {
    return {
      interval: 10,
    };
  }

  get processorConfig(): ProcessorConfig {
    return {
      interval: 5,
      subsidizedRemotes: [
        // TODO: fix this
        "tom",
        "jerry"
      ]
    };
  }

  get kathyConfig(): BaseAgentConfig {
    return {
      interval: 500,
    };
  }

  get bridgeConfig(): BridgeConfiguration {
    return (
      this.network.bridgeConfig || {
        weth: this.network.weth,
        customs: [],
        // mintGas: 200000,
        // deployGas: 850000
      }
    );
  }

  get specs(): NetworkSpecs {
    return (
      this.network.specs || {
        chainId: this.network.chainId,
        finalizationBlocks: 2,
        blockTime: this.network.blockTime,
        supports1559: true,
        confirmations: 2,
        blockExplorer: "",
        indexPageSize: 2000,
      }
    );
  }

  get config(): ContractConfig {
    return (
      this.network.config || {
        optimisticSeconds: 18,
        governance: {
          recoveryManager: this.network.recoveryManager,
          recoveryTimelock: 86400,
        },
        updater: this.network.updater,
        watchers: [this.network.watcher],
      }
    );
  }

  get gasConfig(): NomadGasConfig {
    return {
      core: {
        home: {
          update: {
            base: 100000,
            perMessage: 10000,
          },
          improperUpdate: {
            base: 100000,
            perMessage: 10000,
          },
          doubleUpdate: 200000,
        },
        replica: {
          update: 140000,
          prove: 200000,
          process: 1700000,
          proveAndProcess: 1900000,
          doubleUpdate: 200000,
        },
        connectionManager: {
          ownerUnenrollReplica: 120000,
          unenrollReplica: 120000,
        },
      },
      bridge: {
        bridgeRouter: {
          send: 500000,
        },
        ethHelper: {
          send: 800000,
          sendToEvmLike: 800000,
        },
      },
    };
  }

  get rpcs(): string[] {
    return [this.network.rpcs[0]];
  }
}
