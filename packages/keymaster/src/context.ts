// import { BridgeContext } from '@nomad-xyz/multi-provider';
import { NomadConfig, getBuiltin } from '@nomad-xyz/configuration';
import fs from 'fs';
import { ethers } from 'ethers';
import axios from 'axios';
import { INetwork, KeymasterConfig } from './config';
import { green, red, yellow } from './color';
import dotenv from 'dotenv';
import { createLogger, eth } from './utils';
import Logger from 'bunyan';
dotenv.config();

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
  name: string;
  constructor(name: string, ) {
    this.name = name;
  }
}

abstract class Accountable implements HasAddress, GetsBalance, HasTreshold {
  name: string;
  _address?: string;
  logger: Logger;
  constructor(name: string, logger: Logger) {
    this.name = name;
    this.logger = logger;
  }

  with(logger?: Logger) {
    if (logger) {
      this.logger = logger;
    }
    
    return this;
  }
  abstract address(): Promise<string>;
  abstract balance(): Promise<ethers.BigNumber>;
  abstract treshold(): Promise<ethers.BigNumber> ;
  async shouldTopUp(): Promise<boolean> {
    return (await this.balance()).lt(await this.treshold());
  }

  async howMuchTopUp(): Promise<ethers.BigNumber> {
    const t = await this.treshold();
    const b = await this.balance();
    let tillTreshold = t.sub(b);

    tillTreshold = tillTreshold.lt(0) ? ethers.BigNumber.from(0) : tillTreshold;

    if (tillTreshold.gt(0)) {
      tillTreshold = tillTreshold.add(t.mul(2**1));
    }

    return tillTreshold
  }
}

interface OptionalContextArgs {
  logger?: Logger;
}

interface OptionalNetworkArgs extends OptionalContextArgs {
  treshold?: ethers.BigNumberish;
}


class Account extends Accountable {
  _treshold: ethers.BigNumber;
  _address: string;
  provider: ethers.providers.Provider;
  constructor(name: string, address: string, provider: ethers.providers.Provider, options?: OptionalNetworkArgs) {
    const logger = options?.logger || createLogger(name);
    super(name, logger);
    this._treshold = ethers.BigNumber.from(options?.treshold || eth(1.0));
    this._address = address;
    this.provider = provider;
  }

  address(): Promise<string> {
    this.logger.info(`Getting stored address`)
    return Promise.resolve(this._address);
  }

  async balance(): Promise<ethers.BigNumber> {
    this.logger.info(`Getting balance from provider`)
    const balance = await this.provider.getBalance(await this.address());
    // xxxxxxxx console.log(`${this.name} at ${await this.address()} is ${balance.toString()}`)
    return balance;
  }

  treshold(): Promise<ethers.BigNumber> {
    this.logger.info(`Getting stored treshold`)
    return Promise.resolve(this._treshold);
  }

  static async fromSigner(name: string, signer: ethers.Signer, options?: OptionalNetworkArgs & {provider?: ethers.providers.Provider}) {
    if (options?.provider) {
      signer.connect(options?.provider);
    }
    if (!signer.provider) throw new Error(`KEK`);
    const address = await signer.getAddress();

    return new Account(name, address, signer.provider)
  }

  
}

export class WalletAccount extends Account {
  constructor(address: string, provider: ethers.providers.Provider, options?: OptionalNetworkArgs) {
    super(address.substring(0, 8), address, provider, options)
  }
}

class Agent extends Account {
  constructor(home: string, replica: string, type: string, address: string, provider: ethers.providers.Provider, options?: OptionalNetworkArgs) {
    const slug = home === replica ? `${home}` : `${home}_at_${replica}`
    super(`${type}_of_${slug}`, address, provider, options);
  }
}

class LocalAgent extends Account {
  constructor(home: Network, type: string, address: string, options?: OptionalNetworkArgs) {
    options = {
      ...options,
      ...home.shareContextWithAgent(),
    };
    const name = `${type}_of_${home.name}`;
    options.logger = options?.logger ? options.logger.child({type}) : createLogger(name);
    super(name, address, home.provider, options);
  }
}

class RemoteAgent extends Account {
  constructor(home: Network, replica: Network, type: string, address: string, options?: OptionalNetworkArgs) {
    options = {
      ...options,
      ...home.shareContextWithAgent(replica),
    };
    const name = `${type}_of_${home.name}`;
    const childArgs = {
      type,
      replica: replica.name
    }
    options.logger = options?.logger ? options.logger.child(childArgs) : createLogger(name, childArgs);
    super(name, address, replica.provider, options);
  }
}

class LocalWatcher extends LocalAgent {
  constructor(home: Network, address: string, options?: OptionalNetworkArgs) {
    options = {
      ...options,
      ...home.shareContextWithAgent(),
    };
    // const name = `watcher_${address.slice(-5)}`;
    const childArgs = {type: 'watcher', account: address.slice(-5)};
    options.logger = options?.logger ? options.logger.child(childArgs) : createLogger('watcher', childArgs);
    if (options) options.treshold = home.treshold.mul(5);
    super(home, 'watcher', address, options)
  }

  async howMuchTopUp(): Promise<ethers.BigNumber> {
    this.logger.info(`Checking howMuchTopUp from localWatcher`)

    const t = await this.treshold();
    const b = await this.balance();

    return t.sub(b)
  }
}

class RemoteWatcher extends RemoteAgent {
  constructor(home: Network, replica: Network, address: string, options?: OptionalNetworkArgs) {
    options = {
      ...options,
      ...home.shareContextWithAgent(replica),
    };
    // const name = `watcher_${address.slice(-5)}`;
    const childArgs = {type: 'watcher', account: address.slice(-5)};

    options.logger = options?.logger ? options.logger.child(childArgs) : createLogger('watcher', childArgs);
    if (options) options.treshold = home.treshold.mul(5);
    super(home, replica, 'watcher', address, options)
  }

  async howMuchTopUp(): Promise<ethers.BigNumber> {
    this.logger.info(`Checking howMuchTopUp from RemoteWatcher`)
    const t = await this.treshold();
    const b = await this.balance();

    return t.sub(b)
  }
}


class Bank extends Accountable {
  signer: ethers.Signer;
  _treshold: ethers.BigNumber;
  constructor(name: string, signer: ethers.Signer, options?: OptionalNetworkArgs & {provider?: ethers.providers.Provider, network?: Network}) {
    const logChild = {type: 'bank', home: options?.network?.name};
    const logger = options?.logger ? options.logger.child(logChild) : createLogger(name, logChild);
    super(name, logger);
    if (options?.provider) {
      signer = signer.connect(options.provider);
    }
    this.signer = signer;
    this._treshold = ethers.BigNumber.from(options?.treshold || eth(1.0));
  }

  async address(): Promise<string> {
    this.logger.info(`Getting stored address of a bank`)
    return await this.signer.getAddress();
  }

  treshold(): Promise<ethers.BigNumber> {
    this.logger.info(`Getting stored treshold of a bank`)

    return Promise.resolve(this._treshold);
  }

  async balance(): Promise<ethers.BigNumber> {
    this.logger.info(`Getting balance from signer of a bank`)
    const balance = await this.signer.getBalance();
    // console.log(balance.toString(), await this.address())
    return balance
  }

  async pay(a: Accountable | string, value: ethers.BigNumber) {


    let to;
    if (typeof a === 'string') {
      to = a
    } else {
      to = await a.address();
    }
    this.logger.info({to, amount: ethers.utils.formatEther(value)}, `Paying from signer of a bank`)

    const sent = await this.signer.sendTransaction({to, value});
    const receipt = await sent.wait(3);
    this.logger.info({to, amount: ethers.utils.formatEther(value)}, `Payed from signer of a bank!`)

    return receipt;
  }

  static random(provider: ethers.providers.Provider, treshold?: ethers.BigNumberish): Bank {
    return new Bank('bank', ethers.Wallet.createRandom(), {treshold, provider})
  }
}




export class Network {
  name: string;
  provider: ethers.providers.Provider;
  bank: Bank;
  balances: Accountable[];
  treshold: ethers.BigNumber;
  logger: Logger;
  constructor(name: string, provider: ethers.providers.Provider | string, balances: Accountable[], bank: ethers.Signer, options?: OptionalNetworkArgs) {
    this.name = name;
    if (typeof provider === 'string') {
      this.provider = new ethers.providers.StaticJsonRpcProvider(provider);
    } else {
      this.provider = provider;
    }
    this.treshold = ethers.BigNumber.from(options?.treshold || eth(1));
    this.logger = options?.logger || createLogger(name, {home: name});
    this.bank = new Bank(`${name}_bank`, bank, {...options, provider: this.provider});
    this.balances = balances;
  }


  with(logger?: Logger) {
    if (logger) {
      this.logger = logger;
    }
    
    return this;
  }

  async checkAllBalances() {
    return Object.fromEntries(await Promise.all([
      ['bank', await this.bank.shouldTopUp()],
      ...this.balances.map(async (balance) => {
        return [balance.name, await balance.shouldTopUp()]
      })
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


  async reportSuggestion(): Promise<[Accountable, ethers.BigNumber, ethers.BigNumber][]> {
    const promises: Promise<[Accountable, ethers.BigNumber, ethers.BigNumber]>[] = [...this.balances, this.bank].map(async (a): Promise<[Accountable, ethers.BigNumber, ethers.BigNumber]> => {
      return [a, await a.balance(), await a.howMuchTopUp()]
    });

    const suggestions = await Promise.all(promises);
    return suggestions
  }

  shareContextWithAgent(replica?: Network): OptionalNetworkArgs {
    const child: Object = {
      home: this.name,
      ...replica ? {replica: replica.name}:{}
    };
    
    return {
      logger: this.logger.child(child)
    }
  }

  static fromINetwork(n: INetwork, options?: OptionalNetworkArgs) {
    const {name} = n;
    const envName = name.toUpperCase().replaceAll('-', '_');
    const rpcEnvKey = `${envName}_RPC`;
    const rpc = process.env[rpcEnvKey] || n.endpoint;
    if (!rpc)
      throw new Error(
        `RPC url for network ${name} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`,
      );
      console.log((yellow(`Using ${rpc} for ${name}`)))

      const provider = new ethers.providers.StaticJsonRpcProvider(rpc);
    
    const network = new Network(n.name, provider, [], new ethers.Wallet(n.bank), options);
    const balances = [
      new LocalAgent(network, 'updater', n.agents.updater),
      ...n.agents.watchers.map(w => new LocalWatcher(network, w,)), // should be this only watcher
      ...n.agents.kathy ? [new LocalAgent(network, 'kathy', n.agents.kathy!)] : []
    ];
    network.addBalances(...balances)
    // network.balances.push();

    return network;
  }

  addBalances(...bs: Accountable[]) {
    for (let b of bs) {
      b.logger = b.logger.child({home: this.name});
      this.balances.push(b)
    }
  }

}


export class Keymaster {
  config: KeymasterConfig;
  networks: Map<string, Network>;
  logger: Logger;

  constructor(config: KeymasterConfig, options?: OptionalContextArgs) {
    this.config = config;
    this.networks = new Map();
    this.logger = options?.logger || createLogger(`keymaster`);
  }

  exportContextWithNetwork(networkName: string): OptionalContextArgs {
    return {
      logger: this.logger.child({home: networkName})
    }
  }

  with(logger?: Logger) {
    if (logger) {
      this.logger = logger;
    }
    
    return this;
  }

  static async fromEnvName(config: KeymasterConfig) {
    const context = new Keymaster(config);
    context.init();
    return context;
  }

  init(): Keymaster {
    Object.values(this.config.networks).forEach((n) => {
      this.networks.set(n.name, Network.fromINetwork(n, this.exportContextWithNetwork(n.name)));
    })

    Object.entries(this.config.networks).forEach(([home, homeNetConfig]) => {
      const homeAgents = homeNetConfig.agents;
      const homeNetwork = this.networks.get(home)!;

      for (const replica of homeNetConfig.replicas) {
        const replicaNetwork = this.networks.get(replica)!;


        const balances: Accountable[] = [
          new RemoteAgent(homeNetwork, replicaNetwork, 'relayer', homeAgents.relayer),
          new RemoteAgent(homeNetwork, replicaNetwork, 'processor', homeAgents.processor),
          ...homeAgents.watchers.map(w => new RemoteWatcher(homeNetwork, replicaNetwork, w))
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


// class Report {
//   name: string;
//   topUp: TopUpTask[]
// }

// interface TopUpTask {
//   name: string,
//   address: string,
//   amount: ethers.BigNumber,
// }

// class NetworkReport {

// }