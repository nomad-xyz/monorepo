import { AgentRole, allowAgent, KeymasterConfig } from "./config";
import { Accountable, Network, RemoteAgent, RemoteWatcher } from "./account";
import { Context } from "./context";

export class Keymaster {
  config: KeymasterConfig;
  networks: Map<string, Network>;
  ctx: Context;

  constructor(config: KeymasterConfig) {
    this.config = config;
    this.networks = new Map();
    this.ctx = new Context();
  }

  static async fromEnvName(config: KeymasterConfig) {
    const context = new Keymaster(config);
    context.init();
    return context;
  }

  async init(): Promise<Keymaster> {
    this.config.networks.forEach((n) => {
      this.networks.set(n.name, Network.fromINetwork(n, this.ctx));
    });

    this.config.networks.forEach((homeNetConfig) => {
      const homeAgents = homeNetConfig.agents;
      const homeNetwork = this.networks.get(homeNetConfig.name)!;

      for (const replica of homeNetConfig.replicas) {
        const replicaNetwork = this.networks.get(replica);
        const replicaNetworkConfig = this.config.networks.find(
          (n) => n.name === replica
        );

        if (!replicaNetworkConfig)
          throw new Error(
            `Mentioned replica ${replica} doesn't exist in the original configuration`
          );

        if (!replicaNetwork) throw new Error(`Replica ${replica} not found`);

        const balances: Accountable[] = [];

        if (allowAgent(replicaNetworkConfig, "remote", AgentRole.Relayer)) {
          balances.push(
            new RemoteAgent(
              homeNetwork,
              replicaNetwork,
              AgentRole.Relayer,
              homeAgents.relayer,
              this.ctx
            )
          );
        }

        if (allowAgent(replicaNetworkConfig, "remote", AgentRole.Processor)) {
          balances.push(
            new RemoteAgent(
              homeNetwork,
              replicaNetwork,
              AgentRole.Processor,
              homeAgents.processor,
              this.ctx
            )
          );
        }

        if (allowAgent(replicaNetworkConfig, "remote", AgentRole.Watcher)) {
          balances.push(
            ...homeAgents.watchers.map(
              (w) => new RemoteWatcher(homeNetwork, replicaNetwork, w, this.ctx)
            )
          );
        }

        this.networks.get(replica)!.balances.push(...balances);
      }
    });

    await Promise.all(
      Array.from(this.networks.values()).map(async (n) => {
        await n.init();
      })
    );

    return this;
  }

  async checkAndPayEnabledNetworks(
    networks: string[],
    dryrun = false
  ): Promise<void> {
    for (const net of this.networks.values()) {
      try {
        if (networks.length === 0 || networks.includes(net.name)) {
          await net.checkAndPay(dryrun);
        }
      } catch (e) {
        net.ctx.logger.error(
          `Failed check and pay loop for the whole network.`
        );
        net.ctx.metrics.incMalfunctions(net.name, "checkAndPay");
      }
    }
  }

  get networkNames(): string[] {
    return Object.keys(this.networks);
  }
}
