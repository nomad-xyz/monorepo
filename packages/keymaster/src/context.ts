// import { BridgeContext } from '@nomad-xyz/multi-provider';
import { NomadConfig, getBuiltin } from '@nomad-xyz/configuration';
import fs from 'fs';
import { ethers, providers } from 'ethers';
import axios from 'axios';
import { AgentAddresses, KeymasterConfig } from './config';

export async function getConfig(
  environment: string,
): Promise<NomadConfig> {
  let config: NomadConfig;
  if (['production', 'staging', 'development'].includes(environment)) {
        config = getBuiltin(environment);
    } else if (environment.includes('https')) {
      const response = await axios.get(environment, { responseType: 'json' });
      config = response.data as NomadConfig;
    } else if (fs.existsSync(environment)) {
      let configOverride: NomadConfig | undefined = undefined;

      try {
        configOverride = JSON.parse(fs.readFileSync(environment, 'utf8'));
      } catch (e) {
        throw new Error(`Couldn't read NomadConfig's location: ${environment}`);
      }

      if (!configOverride) throw new Error(`FIX THIS LINE No config!`);

      config = configOverride;
    } else {
      throw new Error(
        `Didn't understand what environment means: ${environment}`,
      );
    }
  
  return config;
}

abstract class GetsBalance {
  abstract balance(): Promise<ethers.BigNumber>;
}

abstract class HasAddress {
  abstract address(): Promise<string> 
}

abstract class HasTreshold {
  abstract treshold(): Promise<ethers.BigNumber>;
}

class Base {
  _treshold: ethers.BigNumber;
  name: string;
  constructor(name: string, treshold?: ethers.BigNumberish) {
    this.name = name;
    this._treshold = treshold?ethers.BigNumber.from(treshold) : ethers.BigNumber.from('1'+'0'.repeat(18));
  }

  async treshold(): Promise<ethers.BigNumber> {
      return Promise.resolve(this._treshold)
    }
}

abstract class Accountable extends Base implements HasAddress, GetsBalance, HasTreshold {
  abstract address(): Promise<string>;
  abstract balance(): Promise<ethers.BigNumber>;
  // abstract treshold(): Promise<ethers.BigNumber>;
  async shouldTopUp(): Promise<boolean> {
    // console.log(`${this.name}_shouldTopUp ${(await this.address())}`, (await this.balance()).toString())
    return (await this.balance()).lt(await this.treshold());
  }
}




class Account extends Accountable {
  _address: string;
  provider: ethers.providers.Provider;
  constructor(name: string, address: string, provider: ethers.providers.Provider, treshold?: ethers.BigNumberish) {
    super(name, treshold);
    this._address = address;
    this.provider = provider;
  }

  address(): Promise<string> {
    return Promise.resolve(this._address);
  }

  async balance(): Promise<ethers.BigNumber> {
    const balance = await this.provider.getBalance(await this.address());
    // xxxxxxxx console.log(`${this.name} at ${await this.address()} is ${balance.toString()}`)
    return balance;
  }

  static async fromSigner(name: string, signer: ethers.Signer, provider?: ethers.providers.Provider) {
    if (provider) {
      signer.connect(provider);
    }
    if (!signer.provider) throw new Error(`KEK`);
    const address = await signer.getAddress();

    return new Account(name, address, signer.provider)
  }
}

class Agent extends Account {
  constructor(home: string, replica: string, type: string, address: string, provider: ethers.providers.Provider, treshold?: ethers.BigNumberish) {
    super(`${type}_of_${home}_at_${replica}`, address, provider, treshold);
  }
}

class Watcher extends Agent {
  constructor(home: string, replica: string, address: string, provider: ethers.providers.Provider, treshold?: ethers.BigNumberish) {
    super(home, replica, `watcher_${address.slice(-5)}`, address, provider, treshold)
  }
}


class Bank extends Accountable {
  signer: ethers.Signer;
  // _treshold: ethers.BigNumber;
  constructor(name: string, signer: ethers.Signer, provider: ethers.providers.Provider, treshold?: ethers.BigNumberish) {
    super(name, treshold);
    if (provider) {
      signer = signer.connect(provider);
    }
    this.signer = signer;
    // this._treshold = ethers.BigNumber.from('2'+'0'.repeat(18))
  }

  async address(): Promise<string> {
    return await this.signer.getAddress();
  }

  async balance(): Promise<ethers.BigNumber> {
    const balance = await this.signer.getBalance();
    // console.log(balance.toString(), await this.address())
    return balance
  }

  static random(provider: ethers.providers.Provider, treshold?: ethers.BigNumberish): Bank {
    return new Bank('bank', ethers.Wallet.createRandom(), provider, treshold)
  }
}



class Network {
  name: string;
  provider: ethers.providers.Provider;
  bank: Bank;
  balances: Accountable[];
  constructor(name: string, provider: ethers.providers.Provider, balances: Accountable[], bank: ethers.Signer, treshold?: ethers.BigNumberish) {
    this.name = name;
    this.provider = provider;
    this.bank = new Bank(`${name}_bank`, bank, this.provider, treshold)
    this.balances = balances;
  }

  async checkAllBalances() {
    return Object.fromEntries(await Promise.all([
      ...this.balances.map(async (balance) => {
        return [balance.name, await balance.shouldTopUp()]
      }),
      ['bank', await this.bank.shouldTopUp()]
    ]))
  }

  async report() {
    return Object.fromEntries(await Promise.all([
      ...this.balances.map(async (balance) => {
        return [balance.name, [await balance.shouldTopUp(), (await balance.balance()).div('1'+'0'.repeat(18)).toString()]]
      }),
      ['bank', [await this.bank.shouldTopUp(), (await this.bank.balance()).div('1'+'0'.repeat(18)).toString()]]
    ]))
  }

}


export class Keymaster {
  config: KeymasterConfig;
  networks: Map<string, Network>;

  constructor(config: KeymasterConfig) {
    this.config = config;
    this.networks = new Map();
  }

  static async fromEnvName(config: KeymasterConfig) {
    const context = new Keymaster(config);
    context.init();
    return context;
  }

  init(): Keymaster {
    Object.entries(this.config.networks).forEach(([name, network]) => {
      
      const envName = name.toUpperCase().replaceAll('-', '_');
      const rpcEnvKey = `${envName}_RPC`;
      const rpc = process.env[rpcEnvKey] || network.endpoint;
      if (!rpc)
        throw new Error(
          `RPC url for network ${name} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`,
        );
  
        const provider = new ethers.providers.StaticJsonRpcProvider(rpc);

        this.networks.set(name, new Network(name, provider, [
          new Agent(name, name, 'updater', network.agents.updater, provider),
          ...network.agents.watchers.map(w => new Watcher(name, name, w, provider)), // should be this only watcher
          ...network.agents.kathy ? [new Agent(name, name, 'kathy', network.agents.kathy!, provider)] : []
        ], new ethers.Wallet(network.bank), network.treshold));

    })

    Object.keys(this.config.networks).forEach(home => {
      const homeNetConfig = this.config.networks[home];
      const homeNet = this.networks.get(home)!;
      const homeAgents = homeNetConfig.agents;
      for (const replica of homeNetConfig.replicas) {
        const replicaNet = this.networks.get(replica)!;
      const replicasAgents = this.config.networks[replica].agents;


        const balances: Accountable[] = [
          new Agent(home, replica, 'relayer', homeAgents.relayer, replicaNet.provider),
          new Agent(home, replica, 'processor', homeAgents.processor, replicaNet.provider),
          ...homeAgents.watchers.map(w => new Watcher(home, replica, w, replicaNet.provider))
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