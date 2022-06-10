import { ethers } from 'ethers';
import { INetwork } from './config';
import { green, red, yellow } from './color';
import { eth, OptionalNetworkArgs, sleep } from './utils';
import { MyJRPCProvider } from './retry_provider/provider';
import { Context } from './context';
import { AwsKmsSigner } from './kms';
import dotenv from 'dotenv';
dotenv.config();


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

  async upperTreshold(): Promise<ethers.BigNumber> {
    const t = await this.treshold();
    return t.mul(2);
  }

  async howMuchTopUp(): Promise<ethers.BigNumber> {
    const ke = ethers.utils.formatEther;

    const b = await this.balance();
    const upper = await this.upperTreshold();
    const t = await this.treshold();
    // console.log(red(`${this.name} -> ${ke(b)}, ${ke(upper)} , ${ke(t)} === ${(await this.balance()).lt(await this.treshold())}`))

    return upper.sub(b);
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

    return new Account(name, address, signer.provider, ctx, options)
  }

  
}

export class WalletAccount extends Account {
  constructor(address: string, provider: ethers.providers.Provider, ctx: Context, options?: OptionalNetworkArgs) {
    super(address.substring(0, 8), address, provider, ctx, options)
  }
}

export class Agent extends Account {
  home: Network;
  replica: Network;
  type: string;
  remote: boolean;
  constructor(home: Network, replica: Network, type: string, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    // console.log(options)
    const slug = home === replica ? `${home.name}` : `${home.name}_at_${replica.name}`
    super(`${type}_of_${slug}`, address, home.provider, ctx, options);
    this.home = home;
    this.replica = replica;
    this.type = type;
    this.remote = home !== replica;
  }

  async balance(): Promise<ethers.BigNumber> {
    const balance = await super.balance();
    this.ctx.metrics.setBalance(this.home.name, this.replica.name, this.remote ? this.replica.name : this.home.name , this.type, balance.div('1'+'0'.repeat(18)).toNumber()) // TODO
    return balance
  }
}

export class LocalAgent extends Agent {
  constructor(home: Network, type: string, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    super(home, home, type, address, ctx.with({type, address, home: home.name, replica: home.name}), {treshold: home.treshold, ...options});
  }
}

export class RemoteAgent extends Account {
  home: Network;
  replica: Network;
  type: string;
  remote: boolean;
  constructor(home: Network, replica: Network, type: string, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    const name = `${type}_of_${home.name}_at_${replica.name}`;
    super(name, address, replica.provider, ctx.with({type, address, home: home.name, replica: replica.name}), {...options, treshold: replica.treshold});
    this.type = type;
    this.home = home;
    this.replica = replica;
    this.remote = true;
  }
}



export class LocalWatcher extends LocalAgent {
  constructor(home: Network, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    if (options) {
      options.treshold = home.treshold.mul(2);
    } else {
      options = {
        treshold: home.treshold.mul(2)
      }
    }
    super(home, 'watcher', address, ctx, options);
  }
}

export class RemoteWatcher extends RemoteAgent {
  constructor(home: Network, replica: Network, address: string, ctx: Context, options?: OptionalNetworkArgs) {
    if (options) {
      options.treshold = replica.treshold.mul(2);
    } else {
      options = {
        treshold: replica.treshold.mul(2)
      }
    }
    super(home, replica, 'watcher', address, ctx, options)
  }
}


export class Bank extends Accountable {
  signer: ethers.Signer;
  home: Network;
  _treshold: ethers.BigNumber;
  constructor(name: string, signer: ethers.Signer, ctx: Context, home: Network, options?: OptionalNetworkArgs & {provider?: ethers.providers.Provider}) {
    super(name, ctx.with({type: 'bank', home: home.name, replica: home.name}));
    if (options?.provider) {
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
    const balance = await this.signer.getBalance();
    const home = this.home.name;
    this.ctx.metrics.setBalance(home, home, home, 'bank', balance.div('1'+'0'.repeat(18)).toNumber()) // TODO
    
    return balance
  }

  async pay(a: Accountable | string, value: ethers.BigNumber) {
    let to;
    if (typeof a === 'string') {
      to = a
    } else {
      to = a._address || await a.address();
    }

    if (a === this) {
      this.ctx.logger.warn(`Should not be sending money to itself`);
    }

    this.ctx.logger.info({to, amount: ethers.utils.formatEther(value)}, `Paying from signer of a bank`)

    const sent = await this.signer.sendTransaction({to, value});
    
    let receipt;

    let t = 0;
    while (t++ < 10) {
      try {
        await sleep(5000);
        receipt = await sent.wait();
        break
      } catch (e) {
        this.ctx.logger.debug({to, amount: ethers.utils.formatEther(value)}, `Failed to pay for try ${t}!`)
      }
    }
    if (!receipt) throw new Error(`No receipt for tx: ${sent.hash}`);
    this.ctx.logger.info({to, amount: ethers.utils.formatEther(value)}, `Payed from signer of a bank!`)

    return receipt;
  }

  async payAgent(a: LocalAgent | RemoteAgent, value: ethers.BigNumber) {
    const result = await this.pay(a, value);

    if (a.remote) {
      this.ctx.metrics.incTransfer(a.home.name, a.home.name, this.home.name, 'bank', value.div('1'+'0'.repeat(18)).toNumber())
    } else {
      this.ctx.metrics.incTransfer(a.home.name, (a as RemoteAgent).replica.name, this.home.name, 'bank', value.div('1'+'0'.repeat(18)).toNumber())
    }

    return result
  }
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
    this.provider = typeof provider === 'string'? new MyJRPCProvider(provider, name, ctx): provider;
    
    this.treshold = ethers.BigNumber.from(options?.treshold || eth(1));
    this.ctx = ctx.with({home: name});
    this.bank = new Bank(`${name}_bank`, bank, ctx, this, {provider: this.provider, ...options});
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


  async reportSuggestion(): Promise<[Accountable, ethers.BigNumber, boolean, ethers.BigNumber][]> {
    const promises: Promise<[Accountable, ethers.BigNumber, boolean, ethers.BigNumber]>[] = [...this.balances, this.bank].map(async (a): Promise<[Accountable, ethers.BigNumber, boolean, ethers.BigNumber]> => {
      return [a, await a.balance(), await a.shouldTopUp(), await a.howMuchTopUp()]
    });

    const suggestions = await Promise.all(promises);
    return suggestions
  }

  async checkAndPay(dryrun=false): Promise<void> {
    console.log(`\n\nNetwork: ${this.name}\n`);
    const ke = ethers.utils.formatEther;

    const suggestions: [Accountable, ethers.BigNumber, boolean, ethers.BigNumber][] = await this.reportSuggestion();

    let _toPay = ethers.BigNumber.from('0');
    let _paid = ethers.BigNumber.from('0');

    for (const [a, balance, shouldTopUp, toPay] of suggestions) {
      // const shouldTopUp = toPay.gt(0);
      if (shouldTopUp) {
        _toPay = _toPay.add(toPay);
          
        if (balance.eq(0)) {
          console.log(red(`${a.name} needs immediately ${ke(toPay)} currency. It is empty for gods sake!`));
        } else {
          console.log(yellow(`${a.name} needs to be paid ${ke(toPay)}. Balance: ${ke(balance)}`));
        }
        const sameAddress = a == this.bank || (await a.address()) === (await this.bank.address());
        if (!sameAddress && !dryrun) {
          await this.bank.pay(a, toPay);
          console.log(green(`Paid ${ke(toPay)} to ${a.name}!`));
          _paid = _paid.add(toPay)
        }
        
      } else {
        console.log(green(`${a.name} is ok, has: ${ke(balance)}`));
      }
    }
    console.log(`\n\tpaid: ${green(ke(_paid))} out of ${yellow(ke(_toPay))}\n\n`)
  }

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

    const provider = new MyJRPCProvider(rpc, name, ctx);
    
    const bank = typeof n.bank === 'string' ? new ethers.Wallet(n.bank) : new AwsKmsSigner(n.bank);

    const network: Network = new Network(n.name, provider, [], bank, ctx, {treshold: n.treshold, ...options});
    
    const balances = [
      new LocalAgent(network, 'updater', n.agents.updater, ctx),
      ...n.agents.watchers.map(w => new LocalWatcher(network, w, ctx)), // should be this only watcher
      ...n.agents.kathy ? [new LocalAgent(network, 'kathy', n.agents.kathy!, ctx)] : []
    ];
    network.addBalances(...balances);



    return network;
  }

  addBalances(...bs: Accountable[]) {
    for (let b of bs) {
      this.balances.push(b)
    }
  }

}