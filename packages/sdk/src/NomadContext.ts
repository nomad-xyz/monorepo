import { providers, Signer, ContractTransaction, BytesLike, Overrides } from 'ethers';

import { MultiProvider } from '@nomad-xyz/multi-provider';
import * as core from '@nomad-xyz/contracts-core';
import * as config from '@nomad-xyz/configuration';
import fetch from 'cross-fetch';

import { CoreContracts } from './CoreContracts';
import { NomadMessage } from './messages/NomadMessage';
import { MessageBackend, GoldSkyBackend } from './messageBackend';

export type Address = string;

type Path = [
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
  BytesLike,
];

export type MessageProof = {
  message: BytesLike;
  proof: {
    leaf: BytesLike;
    index: number;
    path: Path;
  };
};

/**
 * The NomadContext manages connections to Nomad core and Bridge contracts.
 * It inherits from the {@link MultiProvider}, and ensures that its contracts
 * always use the latest registered providers and signers.
 *
 * For convenience, we've pre-constructed contexts for mainnet and testnet
 * deployments. These can be imported directly.
 *
 * @example
 * // Set up mainnet and then access contracts as below:
 * let router = mainnet.mustGetBridge('celo').bridgeRouter;
 */
export class NomadContext extends MultiProvider<config.Domain> {
  protected _cores: Map<string, CoreContracts<this>>;
  protected _blacklist: Set<number>;
  _backend?: MessageBackend;
  readonly conf: config.NomadConfig;

  constructor(
    environment: string | config.NomadConfig = 'development',
    backend?: MessageBackend,
  ) {
    super();

    const conf: config.NomadConfig =
      typeof environment === 'string'
        ? config.getBuiltin(environment)
        : environment;

    config.validateConfig(conf);
    this.conf = conf;
    this._cores = new Map();
    this._blacklist = new Set();
    this._backend = backend;

    for (const network of this.conf.networks) {
      // register domain
      this.registerDomain(this.conf.protocol.networks[network]);
      // register RPC provider
      if (this.conf.rpcs[network] && this.conf.rpcs[network].length > 0) {
        this.registerRpcProvider(network, this.conf.rpcs[network][0]);
      }
      // set core contracts
      const netConf = this.conf.core[network] as {
        upgradeBeaconController?: config.NomadIdentifier;
      };
      // type discrimination
      if (!netConf.upgradeBeaconController)
        throw new Error('substrate not yet supported');
      const core = new CoreContracts(
        this,
        network,
        netConf as unknown as config.EthereumCoreDeploymentInfo,
      );
      this._cores.set(core.domain, core);
    }
  }

  /**
   * Create default backend for the context
   */
  withDefaultBackend(): NomadContext {
    // TODO: What if backend doesn't exist for this environment?
    this._backend = GoldSkyBackend.default(this.environment, this);
    return this;
  }

  get governor(): config.NomadLocator {
    return this.conf.protocol.governor;
  }

  get environment(): string {
    return this.conf.environment;
  }

  /**
   * Register an ethers Provider for a specified domain.
   *
   * @param nameOrDomain A domain name or number.
   * @param provider An ethers Provider to be used by requests to that domain.
   */
  registerProvider(
    nameOrDomain: string | number,
    provider: providers.Provider,
  ): void {
    const domain = this.resolveDomain(nameOrDomain);
    super.registerProvider(domain, provider);
  }

  /**
   * Register an ethers Signer for a specified domain.
   *
   * @param nameOrDomain A domain name or number.
   * @param signer An ethers Signer to be used by requests to that domain.
   */
  registerSigner(nameOrDomain: string | number, signer: Signer): void {
    const domain = this.resolveDomain(nameOrDomain);
    super.registerSigner(domain, signer);
  }

  /**
   * Remove the registered ethers Signer from a domain. This function will
   * attempt to preserve any Provider that was previously connected to this
   * domain.
   *
   * @param nameOrDomain A domain name or number.
   */
  unregisterSigner(nameOrDomain: string | number): void {
    const domain = this.resolveDomain(nameOrDomain);
    super.unregisterSigner(domain);
  }

  /**
   * Clear all signers from all registered domains.
   */
  clearSigners(): void {
    super.clearSigners();
  }

  /**
   * Get the {@link CoreContracts} for a given domain (or undefined)
   *
   * @param nameOrDomain A domain name or number.
   * @returns a {@link CoreContracts} object (or undefined)
   */
  getCore(nameOrDomain: string | number): CoreContracts<this> | undefined {
    const domain = this.resolveDomainName(nameOrDomain);
    return this._cores.get(domain);
  }

  /**
   * Get the {@link CoreContracts} for a given domain (or throw an error)
   *
   * @param nameOrDomain A domain name or number.
   * @returns a {@link CoreContracts} object
   * @throws if no {@link CoreContracts} object exists on that domain.
   */
  mustGetCore(nameOrDomain: string | number): CoreContracts<this> {
    const core = this.getCore(nameOrDomain);
    if (!core) {
      throw new Error(`Missing core for domain: ${nameOrDomain}`);
    }
    return core;
  }

  /**
   * Resolve the replica for the Home domain on the Remote domain (if any).
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @param home the sending domain
   * @param remote the receiving domain
   * @returns An interface for the Replica (if any)
   */
  getReplicaFor(
    home: string | number,
    remote: string | number,
  ): core.Replica | undefined {
    return this.getCore(remote)?.getReplica(home);
  }

  /**
   * Resolve the replica for the Home domain on the Remote domain (or throws).
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @param home the sending domain
   * @param remote the receiving domain
   * @returns An interface for the Replica
   * @throws If no replica is found.
   */
  mustGetReplicaFor(
    home: string | number,
    remote: string | number,
  ): core.Replica {
    const replica = this.getReplicaFor(home, remote);
    if (!replica) {
      throw new Error(`Missing replica for home ${home} & remote ${remote}`);
    }
    return replica;
  }

  /**
   * Discovers the governor domain of this nomad deployment and returns the
   * associated Core.
   *
   * @returns The identifier of the governing domain
   */
  governorCore(): CoreContracts<this> {
    return this.mustGetCore(this.governor.domain);
  }

  /**
   * Proves and Processes a transaction on the destination chain. This is subsidize and
   * automatic on non-Ethereum destinations
   *
   * @dev Ensure that a transaction is ready to be processed. You should ensure the following
   * criteria have been met prior to calling this function:
   *  1. The tx has been relayed (has status of 2):
   *       `const status = await NomadMessage.status()`
   *  2. The `confirmAt` timestamp for the tx is in the past:
   *       `const confirmAt = await NomadMessage.confirmAt()`
   *
   * @param message NomadMessage
   * @param overrides Any tx overrides (e.g. gas limit, gas price)
   * @returns The Contract Transaction receipt
   */
  async process(
    message: NomadMessage<NomadContext>,
    overrides: Overrides = {},
  ): Promise<ContractTransaction> {
    const data = await message.getProof();
    if (!data) throw new Error('Unable to fetch proof');
    return this.processProof(message.origin, message.destination, data, overrides);
  }

  async processProof(
    origin: string | number,
    destination: string | number,
    proof: MessageProof,
    overrides: Overrides = {},
  ): Promise<ContractTransaction> {
    // get replica contract
    const replica = this.mustGetReplicaFor(origin, destination);

    await replica.callStatic.proveAndProcess(
      proof.message,
      proof.proof.path,
      proof.proof.index,
      overrides,
    );

    return replica.proveAndProcess(
      proof.message,
      proof.proof.path,
      proof.proof.index,
      overrides,
    );
  }

  async fetchProof(
    origin: string | number,
    leafIndex: number,
  ): Promise<MessageProof> {
    const s3 = this.conf.s3;
    if (!s3) throw new Error('s3 data not configured');
    const { bucket, region } = s3;
    const originName = this.resolveDomainName(origin);

    const uri = `https://${bucket}.s3.${region}.amazonaws.com/${originName}_${leafIndex}`;
    const response = await fetch(uri);
    if (!response) throw new Error('Unable to fetch proof');
    const data = await response.json();
    if (data.proof && data.message) return data;
    throw new Error('Server returned invalid proof');
  }

  async processByOriginDestinationAndLeaf(
    origin: string | number,
    destination: string | number,
    leafIndex: number,
  ): Promise<ContractTransaction> {
    const proof = await this.fetchProof(origin, leafIndex);
    return await this.processProof(origin, destination, proof);
  }

  blacklist(): Set<number> {
    return this._blacklist;
  }

  async checkHomes(networks: (string | number)[]): Promise<void> {
    for (const n of networks) {
      await this.checkHome(n);
    }
  }

  async checkHome(nameOrDomain: string | number): Promise<void> {
    const domain = this.resolveDomain(nameOrDomain);
    const home = this.mustGetCore(domain).home;
    const state = await home.state();
    if (state === 2) {
      console.log(`Home for domain ${domain} is failed!`);
      this._blacklist.add(domain);
    } else {
      this._blacklist.delete(domain);
    }
  }

  /**
   * Fetch a config from the Nomad config static site.
   *
   * @param environment the environment name to attempt to fetch
   * @returns A NomadConfig
   * @throws If the site is down, the config is not on the site, or the config
   *         is not of a valid format
   */
  static async fetchConfig(environment: string): Promise<config.NomadConfig> {
    const uri = `https://nomad-xyz.github.io/config/${environment}.json`;
    const config: config.NomadConfig = await (
      await fetch(uri, { cache: 'no-cache' })
    ).json();
    return config;
  }

  /**
   * Fetch a config from the Nomad config static site and instantiate a context
   * from it. If there is an issue, this function will fallback to the latest
   * version of the config shipped with the configuration package.
   *
   * Fallback may be disabled by setting `allowFallback` to false
   *
   * @param this this type for the descendant
   * @param env the environment name to attempt to fetch
   * @param allowFallback allow fallback to the builtin env configuration
   * @returns A NomadContext with the latest configuration for the specified env
   * @throws If `allowFallback` is false and the site is down, the config is
   *         not on the site, or the config is not of a valid format
   */
  static async fetch<T extends NomadContext>(
    this: new (env: string | config.NomadConfig) => T,
    env: string,
    allowFallback = true,
  ): Promise<T> {
    try {
      const config = await NomadContext.fetchConfig(env);
      return new this(config);
    } catch (e: unknown) {
      if (allowFallback) {
        console.warn(
          `Unable to retrieve config ${env}. Falling back to built-in config.\n${e}`,
        );
        return new this(env);
      }
      throw e;
    }
  }
}
