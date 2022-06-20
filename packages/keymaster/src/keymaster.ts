import { KeymasterConfig } from "./config";
import { Accountable, Network, RemoteAgent, RemoteWatcher } from "./account";
import { Context } from "./context";
import { formatEther } from "ethers/lib/utils";
import { red } from "./color";

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

  async checkAndPayEnabledNetworks(networks: string[], dryrun = false): Promise<void> {
    for (const net of this.networks.values()) {
      try {
        if (networks.includes(net.name)) {
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
