import Logger from "bunyan";
import { KeymasterConfig } from "./config";
import { Accountable, Network, RemoteAgent, RemoteWatcher } from "./account";
// import { createLogger, OptionalContextArgs } from "./utils";
import { ethers } from "ethers";
import { green, red, yellow } from "./color";
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
  
    init(): Keymaster {
      Object.values(this.config.networks).forEach((n) => {
        this.networks.set(n.name, Network.fromINetwork(n, this.ctx));
      })
  
      Object.entries(this.config.networks).forEach(([home, homeNetConfig]) => {
        const homeAgents = homeNetConfig.agents;
        const homeNetwork = this.networks.get(home)!;
  
        for (const replica of homeNetConfig.replicas) {
          const replicaNetwork = this.networks.get(replica)!;
  
  
          const balances: Accountable[] = [
            new RemoteAgent(homeNetwork, replicaNetwork, 'relayer', homeAgents.relayer, this.ctx),
            new RemoteAgent(homeNetwork, replicaNetwork, 'processor', homeAgents.processor, this.ctx),
            ...homeAgents.watchers.map(w => new RemoteWatcher(homeNetwork, replicaNetwork, w, this.ctx))
          ];
  
          this.networks.get(replica)!.balances.push(...balances);
  
        }
      });
  
      return this
    }
  
    async checkAllNetworks(): Promise<void> {
      for (const [name, x] of this.networks.entries()) {
        const kek: Record<string, boolean> = await x.checkAllBalances();
        const lol = Object.entries(kek).filter(([_, v])=> v).map(([k,_])=> k);
        console.log(name, '\n', lol);
      }
    }
  
    async reportAllNetworks(): Promise<void> {
      for (const [name, x] of this.networks.entries()) {
        const kek: Record<string, [boolean, string]> = await x.report();
        const lol = Object.entries(kek)//.filter(([_, v])=> v[0])//.map(([k,v])=> [k);
        console.log(name, '\n', lol);
      }
    }
  
    async reportLazyAllNetworks(): Promise<void> {
      for (const [name, x] of this.networks.entries()) {
        const kek: [Accountable, ethers.BigNumber, ethers.BigNumber][] = await x.reportSuggestion();
  
        let _toPay = ethers.BigNumber.from(0);
  
  
        const ke = ethers.utils.formatEther;
        const lol = kek.map(([a, balance, toPay]) => {
          _toPay = _toPay.add(toPay);
          const shouldTopUp = toPay.gt(0);
          if (shouldTopUp) {
            if (balance.eq(0)) {
              return red(`${a.name} needs immediately ${ke(toPay)} currency. It is empty for gods sake!`)
            } else {
              return yellow(`${a.name} needs to be paid ${ke(toPay)}. Balance: ${ke(balance)}`)
            }
          } else {
            return green(`${a.name} is ok, has: ${ke(balance)}`)
          }
        })
  
        console.log(`\n\nNetwork: ${name}\n`);
  
        console.log(lol.join('\n'))
  
        console.log(`\n\tto pay: ${red(ethers.utils.formatEther(_toPay))}\n\n`)
      }
    }
  
    get networkNames(): string[] {
      return Object.keys(this.networks);
    }
  
    getProvider(network: string): ethers.providers.Provider {
      return this.networks.get(network)!.provider
    }
  
  
    // semi-useless
    getBank(network: string): ethers.Signer {
      return new ethers.Wallet(this.config.networks[network].bank, this.getProvider(network));
    }
  
    async getBalance(network: string, address: string): Promise<ethers.BigNumber> {
      return await this.getProvider(network).getBalance(address);
    }
  
    async bankBalance(network: string): Promise<ethers.BigNumber> {
      const address = await this.getBank(network).getAddress();
  
      return await this.getBalance(network, address);
    }
  
    getTreshold(network: string): ethers.BigNumber {
      return this.config.networks[network].treshold;
    }
  
    // useless actually
    getUpdaterAddress(network: string): string | undefined {
      return this.config.networks[network].agents.updater;
    }
  
    getWatcherAddresses(network: string): string[] | undefined {
      return this.config.networks[network].agents.watchers;
    }
  
    getRelayerAddress(network: string): string | undefined {
      return this.config.networks[network].agents.relayer;
    }
  
    getProcessorAddress(network: string): string | undefined {
      return this.config.networks[network].agents.relayer;
    }
  
    getKathyAddress(network: string): string | undefined {
      return this.config.networks[network].agents.relayer;
    }
  
    getReplicas(network: string): string[] {
      return Object.keys(this.config.networks[network].replicas) || [];
    }
  
    async bankTresholdMet(network: string): Promise<boolean> {
      const balance = await this.bankBalance(network);
      return balance.gt(this.getTreshold(network))
    }
  
    async updaterTresholdMet(network: string): Promise<boolean> {
      const address = this.getUpdaterAddress(network);
      if (!address) throw new Error(`No address for Updater`);
      const treshold = this.getTreshold(network);
      const balance = await this.getBalance(network, address);
      return balance.gt(treshold);
    }
    async allWatchersTresholdMet(network: string): Promise<boolean> {
      const balances = await this.watchersTresholdMet(network);
      return balances.every(b => b);
    }
    async watchersTresholdMet(network: string): Promise<boolean[]> {
      const addresses = this.getWatcherAddresses(network);
      if (!addresses) throw new Error(`No address for Updater`);
      const treshold = this.getTreshold(network);
      return await Promise.all(addresses.map(async (a) => {
        const balance = await this.getBalance(network, a);
        return balance.gt(treshold);
      }))
    }
    async relayerTresholdMet(network: string): Promise<boolean> {
      const address = this.getRelayerAddress(network);
      if (!address) throw new Error(`No address for Relayer`);
      const treshold = this.getTreshold(network);
      const balance = await this.getBalance(network, address);
      return balance.gt(treshold);
    }
    async processorTresholdMet(network: string): Promise<boolean> {
      const address = this.getProcessorAddress(network);
      if (!address) throw new Error(`No address for Processor`);
      const treshold = this.getTreshold(network);
      const balance = await this.getBalance(network, address);
      return balance.gt(treshold);
    }
    async kathyTresholdMet(network: string): Promise<boolean> {
      const address = this.getKathyAddress(network);
      if (!address) throw new Error(`No address for Kathy`);
      const treshold = this.getTreshold(network);
      const balance = await this.getBalance(network, address);
      return balance.gt(treshold);
    }
  
  }
  