import { ethers } from "ethers";
import {
  AddressWithThreshold,
  AgentRole,
  allowAgent,
  INetwork,
  justAddress,
} from "./config";
import { green, red, yellow } from "./color";
import { eth, OptionalNetworkArgs, sleep } from "./utils";
import { MyJRPCProvider } from "./retry_provider/provider";
import { Context } from "./context";
import { AwsKmsSigner } from "./kms";
import dotenv from "dotenv";
import { formatEther } from "ethers/lib/utils";
dotenv.config();

const prettyPrint = process.env.PRETTY_PRINT === "true";

const hardcodedGasLimits: Record<string, ethers.BigNumberish> = {
  bsctestnet: 30000,
  arbitrumrinkeby: 600000,
  optimismkovan: 30000,
  optimismgoerli: 30000,
};

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
  abstract threshold(): Promise<ethers.BigNumber>;
  async shouldTopUp(): Promise<boolean> {
    return (await this.balance()).lt(await this.threshold());
  }

  async upperThreshold(): Promise<ethers.BigNumber> {
    const t = await this.threshold();
    return t.mul(2);
  }

  async howMuchTopUp(): Promise<ethers.BigNumber> {
    const b = await this.balance();
    const upper = await this.upperThreshold();

    return upper.sub(b);
  }
}

// Normal address with provider
export class Account extends Accountable {
  _threshold: ethers.BigNumber;
  _address: string;
  provider: ethers.providers.Provider;
  constructor(
    name: string,
    address: AddressWithThreshold,
    provider: ethers.providers.Provider,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    super(name, ctx);

    let realAddress;
    let threshold: ethers.BigNumberish;
    if (typeof address === "string") {
      realAddress = address;
      threshold = options?.threshold || eth(1);
    } else {
      realAddress = address.address;
      threshold = address.threshold;
    }

    this._threshold = ethers.BigNumber.from(threshold);
    this._address = realAddress;
    this.provider = provider;
  }

  address(): Promise<string> {
    this.ctx.logger.debug(`Getting stored address`);
    return Promise.resolve(this._address);
  }

  async balance(): Promise<ethers.BigNumber> {
    const n = await this.provider.getNetwork();

    this.ctx.logger.debug(
      `Getting balance from provider ${await this.address()}`
    );
    const balance = await this.provider.getBalance(await this.address());
    return balance;
  }

  threshold(): Promise<ethers.BigNumber> {
    this.ctx.logger.debug(`Getting stored threshold`);
    return Promise.resolve(this._threshold);
  }

  static async fromSigner(
    name: string,
    signer: ethers.Signer,
    ctx: Context,
    options?: OptionalNetworkArgs & { provider?: ethers.providers.Provider }
  ) {
    if (options?.provider) {
      signer.connect(options?.provider);
    }
    if (!signer.provider) throw new Error(`KEK`);
    const address = await signer.getAddress();

    return new Account(name, address, signer.provider, ctx, options);
  }
}

export class WalletAccount extends Account {
  constructor(
    address: string,
    provider: ethers.providers.Provider,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    super(address.substring(0, 8), address, provider, ctx, options);
  }
}

export class Agent extends Account {
  home: Network;
  replica: Network;
  role: string;
  remote: boolean;
  agent: true;
  constructor(
    home: Network,
    replica: Network,
    role: string,
    address: AddressWithThreshold,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    const remote = home !== replica;
    const slug =
      home === replica ? `${home.name}` : `${home.name}_at_${replica.name}`;
    super(
      `${role}_of_${slug}`,
      address,
      remote ? replica.provider : home.provider,
      ctx,
      options
    );
    this.home = home;
    this.replica = replica;
    this.role = role;
    this.remote = remote;
    this.agent = true;
  }

  async balance(): Promise<ethers.BigNumber> {
    const balance = await super.balance();
    this.ctx.metrics.setBalance(
      this.home.name,
      this.replica.name,
      this.remote ? this.replica.name : this.home.name,
      this.role,
      balance,
      await this.address()
    );
    return balance;
  }

  async suggestion(): Promise<[ethers.BigNumber, boolean, ethers.BigNumber]> {
    const balance = await this.balance();
    const shouldTopUp = balance.lt(await this.threshold());
    const upper = await this.upperThreshold();
    const howMuchTopUp = upper.sub(balance);

    return [balance, shouldTopUp, howMuchTopUp];
  }

  static isAgent(something: Agent | string | Accountable): something is Agent {
    return (<Agent>something).remote !== undefined;
  }
}

export class LocalAgent extends Agent {
  constructor(
    home: Network,
    role: string,
    address: AddressWithThreshold,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    super(
      home,
      home,
      role,
      address,
      ctx.with({
        role,
        address: justAddress(address),
        home: home.name,
        replica: home.name,
        network: home.name,
      }),
      { threshold: home.threshold, ...options }
    );
  }
}

export class RemoteAgent extends Agent {
  constructor(
    home: Network,
    replica: Network,
    role: string,
    address: AddressWithThreshold,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    const name = `${role}_of_${home.name}_at_${replica.name}`;

    super(
      home,
      replica,
      role,
      address,
      // replica.provider,
      ctx.with({
        role,
        address: justAddress(address),
        home: home.name,
        replica: replica.name,
        network: replica.name,
      }),
      { threshold: replica.threshold, ...options }
    );
  }
}

export class LocalWatcher extends LocalAgent {
  constructor(
    home: Network,
    address: AddressWithThreshold,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    super(home, "watcher", address, ctx, {
      ...options,
      threshold: home.watcherThreshold || home.threshold,
    });
  }

  async upperThreshold(): Promise<ethers.BigNumber> {
    return this.home.watcherThreshold || (await this.threshold()).mul(2);
  }
}

export class RemoteWatcher extends RemoteAgent {
  constructor(
    home: Network,
    replica: Network,
    address: AddressWithThreshold,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    let threshold = replica.watcherThreshold || replica.threshold;

    if (options) {
      options.threshold = threshold;
    } else {
      options = {
        threshold: threshold,
      };
    }

    super(home, replica, "watcher", address, ctx, options);
  }

  async upperThreshold(): Promise<ethers.BigNumber> {
    return this.replica.watcherThreshold || (await this.threshold()).mul(2);
  }
}

export class Bank extends Accountable {
  signer: ethers.Signer;
  home: Network;
  _threshold: ethers.BigNumber;
  constructor(
    name: string,
    signer: ethers.Signer,
    ctx: Context,
    home: Network,
    options?: OptionalNetworkArgs & { provider?: ethers.providers.Provider }
  ) {
    super(
      name,
      ctx.with({
        role: "bank",
        home: home.name,
        replica: home.name,
        network: home.name,
      })
    );
    if (options?.provider) {
      signer = signer.connect(options.provider);
    }
    this.home = home;
    this.signer = signer;
    this._threshold = ethers.BigNumber.from(options?.threshold || eth(1.0));
  }

  async address(): Promise<string> {
    this.ctx.logger.debug(`Getting stored address of a bank`);
    return await this.signer.getAddress();
  }

  threshold(): Promise<ethers.BigNumber> {
    this.ctx.logger.debug(`Getting stored threshold of a bank`);
    return Promise.resolve(this._threshold);
  }

  async balance(): Promise<ethers.BigNumber> {
    this.ctx.logger.debug(`Getting balance from signer of a bank`);

    const balance = await this.signer.getBalance();
    const home = this.home.name;
    this.ctx.metrics.setBalance(
      home,
      home,
      home,
      "bank",
      balance,
      await this.address()
    ); // TODO await this.address()

    return balance;
  }

  async pay(
    a: Accountable | string | LocalAgent | RemoteAgent,
    value: ethers.BigNumber
  ) {
    let to;
    if (typeof a === "string") {
      to = a;
    } else {
      to = a._address || (await a.address());
    }

    if (a === this) {
      this.ctx.logger.warn(`Should not be sending money to itself`);
    }

    this.ctx.logger.info(
      { to, amount: formatEther(value) },
      `Paying from signer of a bank`
    );

    const gasLimit = hardcodedGasLimits[this.home.name];
    const sent = await this.signer.sendTransaction({ to, value, gasLimit });

    let receipt;

    let t = 0;
    while (t++ < 10) {
      try {
        await sleep(5000);
        receipt = await sent.wait();
        break;
      } catch (e) {
        this.ctx.logger.debug(
          { to, amount: ethers.utils.formatEther(value) },
          `Failed to pay for try ${t}!`
        );
      }
    }
    if (!receipt) {
      this.ctx.logger.error(
        { to, amount: ethers.utils.formatEther(value) },
        `Failed to pay from bank`
      );
      throw new Error(`No receipt for tx: ${sent.hash}`);
    }

    let role;

    if (Agent.isAgent(a)) {
      role = a.role;
      if (a.remote) {
        this.ctx.metrics.observeTransfer(
          a.home.name,
          a.home.name,
          this.home.name,
          a.role,
          value,
          await a.address()
        );
      } else {
        this.ctx.metrics.observeTransfer(
          a.home.name,
          (a as RemoteAgent).replica.name,
          this.home.name,
          a.role,
          value,
          await a.address()
        );
      }
    } else {
      role = "balance";
      this.ctx.metrics.observeTransfer(
        "balance",
        "balance",
        this.home.name,
        role,
        value,
        typeof a === "string" ? a : await a.address()
      );
    }

    this.ctx.logger.info(
      {
        to,
        amount: ethers.utils.formatEther(value),
        role,
        bank: await this.signer.getAddress(),
      },
      `Payed from signer of a bank!`
    );

    return receipt;
  }
}

export class Network {
  name: string;
  provider: ethers.providers.Provider;
  bank: Bank;
  balances: Accountable[];
  threshold: ethers.BigNumber;
  watcherThreshold: ethers.BigNumber;
  ctx: Context;
  constructor(
    name: string,
    provider: ethers.providers.Provider | string,
    balances: Accountable[],
    bank: ethers.Signer,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    this.name = name;
    this.provider =
      typeof provider === "string"
        ? new MyJRPCProvider(provider, name, ctx)
        : provider;

    this.threshold = ethers.BigNumber.from(options?.threshold || eth(1));
    this.watcherThreshold = ethers.BigNumber.from(
      options?.watcherThreshold || this.threshold
    );
    this.ctx = ctx.with({ home: name, network: name });
    this.bank = new Bank(`${name}_bank`, bank, ctx, this, {
      provider: this.provider,
      ...options,
    });
    this.balances = balances;
  }

  async init() {
    const thresholds = await Promise.all(
      this.balances.map(async (a) => {
        return await a.threshold();
      })
    );
    const threshold = thresholds.reduce(
      (acc, v) => acc.add(v),
      ethers.BigNumber.from("0")
    );

    // Temporary hardcode value, so that we don't get much noise when currently we don't want to put 26 eth into the bank
    // TODO: fix strategy
    // this.bank._threshold = threshold;
    this.bank._threshold = eth(4);
  }

  async checkAllBalances() {
    return Object.fromEntries(
      await Promise.all([
        ["bank", await this.bank.shouldTopUp()],
        ...this.balances.map(async (balance) => {
          return [balance.name, await balance.shouldTopUp()];
        }),
      ])
    );
  }

  async reportSuggestions(): Promise<
    [Accountable, ethers.BigNumber, boolean, ethers.BigNumber][]
  > {
    const promises: Promise<
      [Accountable, ethers.BigNumber, boolean, ethers.BigNumber] | null
    >[] = this.balances.map(
      async (
        a
      ): Promise<
        [Accountable, ethers.BigNumber, boolean, ethers.BigNumber] | null
      > => {
        const aa = a as any as Agent;
        try {
          const [balance, shouldTopUp, howMuchTopUp] = await aa.suggestion();
          return [a, balance, shouldTopUp, howMuchTopUp];
        } catch (e) {
          this.ctx.metrics.incMalfunctions(this.name, "suggestion");
          this.ctx.logger.error(
            { address: await a.address(), error: e },
            "Failed getting suggestion for an account"
          );
          return null;
        }
      }
    );

    const suggestions = await Promise.all(promises);

    function notEmpty<TValue>(
      value: TValue | null | undefined
    ): value is TValue {
      return value !== null && value !== undefined;
    }
    return suggestions.filter(notEmpty);
  }

  async checkAndPay(dryrun = false): Promise<void> {
    if (prettyPrint) console.log(`\n\nNetwork: ${this.name}\n`);

    // BANK

    try {
      const [bankAddress, bankBalance, bankThreshold] = await Promise.all([
        this.bank.address(),
        this.bank.balance(),
        this.bank.threshold(),
      ]);

      if (bankBalance.lt(bankThreshold)) {
        this.ctx.logger.warn(
          {
            address: bankAddress,
            balance: formatEther(bankBalance),
            threshold: formatEther(bankThreshold),
          },
          `Bank balance is less than threshold, please top up`
        );
        if (prettyPrint)
          console.log(
            red(
              `Bank balance is less than threshold, please top up ${formatEther(
                bankThreshold.sub(bankBalance)
              )} currency. Has ${formatEther(bankBalance)} out of ${formatEther(
                bankThreshold
              )}. Address: ${bankAddress}`
            )
          );
      } else {
        this.ctx.logger.debug(
          {
            balance: formatEther(bankBalance),
            threshold: formatEther(bankThreshold),
            address: bankAddress,
          },
          `Bank has enough moneyz`
        );
        if (prettyPrint)
          console.log(
            green(
              `Bank has enough moneyz. Has ${formatEther(
                bankBalance
              )} out of ${formatEther(
                bankThreshold
              )}. Bank address: ${bankAddress}`
            )
          );
      }
    } catch (e) {
      this.ctx.logger.error(
        { address: await this.bank.address() },
        `Failed getting balance or threshold for the bank`
      );
    }

    // AGENTS

    let suggestions: [
      Accountable,
      ethers.BigNumber,
      boolean,
      ethers.BigNumber
    ][];

    try {
      suggestions = await this.reportSuggestions();
    } catch (e) {
      this.ctx.logger.error(`Failed getting payment suggestions`);
      this.ctx.metrics.incMalfunctions(this.name, "suggestions");
      throw e;
    }

    let _toPay = ethers.BigNumber.from("0");
    let _paid = ethers.BigNumber.from("0");

    for (const [a, balance, shouldTopUp, toPay] of suggestions) {
      if (shouldTopUp) {
        _toPay = _toPay.add(toPay);

        if (prettyPrint) {
          if (balance.eq(0)) {
            console.log(
              red(
                `${a.name} needs immediately ${formatEther(
                  toPay
                )} currency. It is empty for gods sake!`
              )
            );
          } else {
            console.log(
              yellow(
                `${a.name} needs to be paid ${formatEther(
                  toPay
                )}. Balance: ${formatEther(balance)}`
              )
            );
          }
        }

        const sameAddress =
          a == this.bank || (await a.address()) === (await this.bank.address());
        if (!sameAddress && !dryrun) {
          try {
            await this.bank.pay(a, toPay);
            if (prettyPrint)
              console.log(green(`Paid ${formatEther(toPay)} to ${a.name}!`));
            _paid = _paid.add(toPay);
          } catch (e) {
            this.ctx.metrics.incMalfunctions(this.name, "payment");
            this.ctx.logger.error(
              { address: await a.address(), error: `${e}` },
              "Payment failure"
            );
            if (prettyPrint)
              console.log(
                green(
                  `Haven't paid ${formatEther(toPay)} to ${
                    a.name
                  }, because of a malfunction!`
                )
              );
          }
        }
      } else {
        if (prettyPrint)
          console.log(green(`${a.name} is ok, has: ${formatEther(balance)}`));
      }
    }
    if (prettyPrint)
      console.log(
        `\n\t[${yellow(this.name)}] paid: ${green(
          formatEther(_paid)
        )} out of ${yellow(formatEther(_toPay))}\n\n`
      );
  }

  static fromINetwork(
    n: INetwork,
    ctx: Context,
    options?: OptionalNetworkArgs
  ) {
    const { name } = n;
    const envName = name.toUpperCase().replace(/\-/g, "_");
    const rpcEnvKey = `${envName}_RPC`;
    const rpc = process.env[rpcEnvKey] || n.endpoint;
    if (!rpc)
      throw new Error(
        `RPC url for network ${name} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`
      );
    if (prettyPrint) console.log(yellow(`Using ${rpc} for ${name}`));

    const provider = new MyJRPCProvider(rpc, name, ctx);

    const bank =
      typeof n.bank === "string"
        ? new ethers.Wallet(n.bank)
        : new AwsKmsSigner(n.bank);

    const network: Network = new Network(n.name, provider, [], bank, ctx, {
      threshold: n.threshold,
      watcherThreshold: n.watcherThreshold,
      ...options,
    });

    const balances = [];

    if (allowAgent(n, "local", AgentRole.Updater)) {
      balances.push(
        new LocalAgent(network, AgentRole.Updater, n.agents.updater, ctx)
      );
    }

    if (allowAgent(n, "local", AgentRole.Watcher)) {
      balances.push(
        ...n.agents.watchers.map((w) => new LocalWatcher(network, w, ctx))
      );
    }

    if (n.agents.kathy && allowAgent(n, "local", AgentRole.Kathy)) {
      balances.push(
        new LocalAgent(network, AgentRole.Kathy, n.agents.kathy!, ctx)
      );
    }

    network.addBalances(...balances);

    return network;
  }

  addBalances(...bs: Accountable[]) {
    for (let b of bs) {
      this.balances.push(b);
    }
  }
}
