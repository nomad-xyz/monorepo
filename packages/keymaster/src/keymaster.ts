import { KeymasterConfig } from "./config";
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
    Object.values(this.config.networks).forEach((n) => {
      this.networks.set(n.name, Network.fromINetwork(n, this.ctx));
    });

    Object.entries(this.config.networks).forEach(([home, homeNetConfig]) => {
      const homeAgents = homeNetConfig.agents;
      const homeNetwork = this.networks.get(home)!;

      for (const replica of homeNetConfig.replicas) {
        const replicaNetwork = this.networks.get(replica);

        if (!replicaNetwork) throw new Error(`Replica ${replica} not found`);

        const balances: Accountable[] = [
          new RemoteAgent(
            homeNetwork,
            replicaNetwork,
            "relayer",
            homeAgents.relayer,
            this.ctx
          ),
          new RemoteAgent(
            homeNetwork,
            replicaNetwork,
            "processor",
            homeAgents.processor,
            this.ctx
          ),
          ...homeAgents.watchers.map(
            (w) => new RemoteWatcher(homeNetwork, replicaNetwork, w, this.ctx)
          ),
        ];

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

  async checkAndPayAllNetworks(dryrun = false): Promise<void> {
    for (const net of this.networks.values()) {
      try {
        await net.checkAndPay(dryrun);
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
