import { NomadConfig, getBuiltin } from '@nomad-xyz/configuration';
import fs from 'fs';
import { ethers } from 'ethers';
import axios from 'axios';
import { INetwork } from './config';
import { green, red, yellow } from './color';
import dotenv from 'dotenv';
import { eth, logToFile, OptionalNetworkArgs } from './utils';
import { MyJRPCProvider } from './retry_provider/provider';
import { Context } from './context';
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

export abstract class Accountable {
  name: string;
  _address?: string;
  ctx: Context;
  constructor(name: string, ctx: Context) {
    this.name = name;
    this.ctx = ctx;
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

// Normal address with provider
export class Account extends Accountable {
  _treshold: ethers.BigNumber;
  _address: string;
  provider: ethers.providers.Provider;
  constructor(name: string, address: string, provider: ethers.providers.Provider, ctx: Context, options?: OptionalNetworkArgs) {
    super(name, ctx);
    this._treshold = ethers.BigNumber.from(options?.treshold || eth(1.0));
    this._address = address;
    this.provider = provider;
  }

  address(): Promise<string> {
    this.ctx.logger.info(`Getting stored address`)
    return Promise.resolve(this._address);
  }

  async balance(): Promise<ethers.BigNumber> {
    this.ctx.logger.info(`Getting balance from provider`)
    const balance = await this.provider.getBalance(await this.address());
    // xxxxxxxx console.log(`${this.name} at ${await this.address()} is ${balance.toString()}`)
    return balance;
  }

  treshold(): Promise<ethers.BigNumber> {
    this.ctx.logger.info(`Getting stored treshold`)
    return Promise.resolve(this._treshold);
  }

  static async fromSigner(name: string, signer: ethers.Signer, ctx: Context, options?: OptionalNetworkArgs & {provider?: ethers.providers.Provider}) {
    if (options?.provider) {
      signer.connect(options?.provider);
    }
    if (!signer.provider) throw new Error(`KEK`);
    const address = await signer.getAddress();

    return new Account(name, address, signer.provider, ctx)
  }

  
}

export class WalletAccount extends Account {
  constructor(address: string, provider: ethers.providers.Provider, ctx: Context, options?: OptionalNetworkArgs) {
    super(address.substring(0, 8), address, provider, ctx, options)
  }
}

// export class Agent extends Account {
//   constructor(home: string, replica: string, type: string, address: string, provider: ethers.providers.Provider, options?: OptionalNetworkArgs) {
//     const slug = home === replica ? `${home}` : `${home}_at_${replica}`
//     super(`${type}_of_${slug}`, address, provider, options);
//   }
// }

export class LocalAgent extends Account {
  home: Network;
  type: string;
  remote: boolean;
  constructor(home: Network, type: string, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    const name = `${type}_of_${home.name}`;
    // options.logger = options?.logger ? options.logger.child(childArgs) : createLogger(name, childArgs);
    super(name, address, home.provider, ctx.with({type, address, home: home.name, replica: home.name}), options);
    this.home = home;
    this.type = type;
    this.remote = false;
  }

  async balance(): Promise<ethers.BigNumber> {
    const balance = await super.balance();
    const home = this.home.name;
    this.ctx.metrics.setBalance(home, home, home, this.type, balance.div('1'+'0'.repeat(18)).toNumber()) // TODO
    return balance
  }
}

export class RemoteAgent extends Account {
  home: Network;
  replica: Network;
  type: string;
  remote: boolean;
  constructor(home: Network, replica: Network, type: string, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    const name = `${type}_of_${home.name}_at_${replica.name}`;
    super(name, address, replica.provider, ctx.with({type, address, home: home.name, replica: replica.name}), options);
    this.type = type;
    this.home = home;
    this.replica = replica;
    this.remote = true;
  }

  async balance(): Promise<ethers.BigNumber> {
    const balance = await super.balance();
    const home = this.home.name;
    const replica = this.replica.name;
    this.ctx.metrics.setBalance(home, replica, replica, this.type, balance.div('1'+'0'.repeat(18)).toNumber()) // TODO
    return balance
  }
}

export class LocalWatcher extends LocalAgent {
  constructor(home: Network, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    if (options) options.treshold = home.treshold.mul(5);
    super(home, 'watcher', address, ctx.with({type: 'watcher', address, home: home.name, replica: home.name}), options);
    this.type = 'watcher';
  }

  async howMuchTopUp(): Promise<ethers.BigNumber> {
    this.ctx.logger.info(`Checking howMuchTopUp from localWatcher`)

    const t = await this.treshold();
    const b = await this.balance();

    return t.sub(b)
  }
}

export class RemoteWatcher extends RemoteAgent {
  constructor(home: Network, replica: Network, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    if (options) options.treshold = home.treshold.mul(5);
    super(home, replica, 'watcher', address, ctx.with({type: 'watcher', address, home: home.name, replica: replica.name}), options)
    this.type = 'watcher';
  }

  async howMuchTopUp(): Promise<ethers.BigNumber> {
    this.ctx.logger.info(`Checking howMuchTopUp from RemoteWatcher`)
    const t = await this.treshold();
    const b = await this.balance();

    return t.sub(b)
  }
}


export class Bank extends Accountable {
  signer: ethers.Signer;
  home: Network;
  _treshold: ethers.BigNumber;
  constructor(name: string, signer: ethers.Signer, ctx: Context, home: Network, options?: OptionalNetworkArgs & {provider?: ethers.providers.Provider}) {
    // const logChild = {type: 'bank', home: options?.network?.name};
    // const logger = options?.logger ? options.logger.child(logChild) : createLogger(name, logChild);
    
    super(name, ctx.with({type: 'bank', home: home.name, replica: home.name}));
    if (options?.provider) {
      logToFile(`CONNECTED!!!!`)
      signer = signer.connect(options.provider);
    }
    this.home = home;
    this.signer = signer;
    this._treshold = ethers.BigNumber.from(options?.treshold || eth(1.0));
  }

  async address(): Promise<string> {
    this.ctx.logger.info(`Getting stored address of a bank`)
    return await this.signer.getAddress();
  }

  treshold(): Promise<ethers.BigNumber> {
    this.ctx.logger.info(`Getting stored treshold of a bank`)

    return Promise.resolve(this._treshold);
  }

  async balance(): Promise<ethers.BigNumber> {
    this.ctx.logger.info(`Getting balance from signer of a bank`)
    console.log(this.signer)
    console.log(this.signer.provider)
    const balance = await this.signer.getBalance();
    // console.log(balance.toString(), await this.address())
    const home = this.home.name;
    this.ctx.metrics.setBalance(home, home, home, 'bank', balance.div('1'+'0'.repeat(18)).toNumber()) // TODO
    
    return balance
  }

  async pay(a: Accountable | string, value: ethers.BigNumber) {
    let to;
    if (typeof a === 'string') {
      to = a
    } else {
      to = await a.address();
    }
    this.ctx.logger.info({to, amount: ethers.utils.formatEther(value)}, `Paying from signer of a bank`)

    const sent = await this.signer.sendTransaction({to, value});
    const receipt = await sent.wait(3);
    this.ctx.logger.info({to, amount: ethers.utils.formatEther(value)}, `Payed from signer of a bank!`)

    return receipt;
  }

  async payAgent(a: LocalAgent | RemoteAgent, value: ethers.BigNumber) {
    // let to;
    // if (typeof a === 'string') {
    //   to = a
    // } else {
    //   to = await a.address();
    // }
    const result = await this.pay(a, value);

    if (a.remote) {
      this.ctx.metrics.incTransfer(a.home.name, a.home.name, this.home.name, 'bank', value.div('1'+'0'.repeat(18)).toNumber())
    } else {
      this.ctx.metrics.incTransfer(a.home.name, (a as RemoteAgent).replica.name, this.home.name, 'bank', value.div('1'+'0'.repeat(18)).toNumber())
    }

    return result
  }

  // static random(provider: ethers.providers.Provider, ctx: Context, treshold?: ethers.BigNumber): Bank {
  //   return new Bank('bank', ethers.Wallet.createRandom(),  ctx, {treshold, provider})
  // }
}




export class Network {
  name: string;
  provider: ethers.providers.Provider;
  bank: Bank;
  balances: Accountable[];
  treshold: ethers.BigNumber;
  ctx: Context;
  constructor(name: string, provider: ethers.providers.Provider | string, balances: Accountable[], bank: ethers.Signer, ctx: Context, options?: OptionalNetworkArgs) {
    this.name = name;
    if (typeof provider === 'string') {
      this.provider = new MyJRPCProvider(provider, name, ctx);
    } else {
      this.provider = provider;
    }
    this.treshold = ethers.BigNumber.from(options?.treshold || eth(1));
    this.ctx = ctx.with({home: name});
    this.bank = new Bank(`${name}_bank`, bank, ctx, this, {...options, provider: this.provider});
    this.balances = balances;
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

  // shareContextWithAgent(replica?: Network): OptionalNetworkArgs {
  //   const child: Object = {
  //     home: this.name,
  //     ...replica ? {replica: replica.name}:{}
  //   };
    
  //   return {
  //     logger: this.logger.child(child)
  //   }
  // }

  static fromINetwork(n: INetwork, ctx: Context, options?: OptionalNetworkArgs) {
    const {name} = n;
    const envName = name.toUpperCase().replaceAll('-', '_');
    const rpcEnvKey = `${envName}_RPC`;
    const rpc = process.env[rpcEnvKey] || n.endpoint;
    if (!rpc)
      throw new Error(
        `RPC url for network ${name} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`,
      );
      console.log((yellow(`Using ${rpc} for ${name}`)))

      const provider = new MyJRPCProvider(rpc, name, ctx)// new ethers.providers.StaticJsonRpcProvider(rpc);
    
    const network = new Network(n.name, provider, [], new ethers.Wallet(n.bank), ctx, options);
    const balances = [
      new LocalAgent(network, 'updater', n.agents.updater, ctx),
      ...n.agents.watchers.map(w => new LocalWatcher(network, w, ctx)), // should be this only watcher
      ...n.agents.kathy ? [new LocalAgent(network, 'kathy', n.agents.kathy!, ctx)] : []
    ];
    network.addBalances(...balances);


    // network.balances.push();

    return network;
  }

  addBalances(...bs: Accountable[]) {
    for (let b of bs) {
      // b.logger = b.logger.child({home: this.name});
      this.balances.push(b)
    }
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