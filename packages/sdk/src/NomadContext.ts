import { providers, Signer, ContractTransaction } from 'ethers';

import { MultiProvider } from '@nomad-xyz/multi-provider';
import * as core from '@nomad-xyz/contracts-core';
import * as config from '@nomad-xyz/configuration';

import { CoreContracts } from './CoreContracts';
import { NomadMessage } from './messages/NomadMessage'

export type Address = string;

const s3URLs: { [key: string]: string } = {
  production: 'https://nomadxyz-production-proofs.s3.us-west-2.amazonaws.com/',
  development: 'https://nomadxyz-development-proofs.s3.us-west-2.amazonaws.com/',
  staging: 'https://nomadxyz-staging-proofs.s3.us-west-2.amazonaws.com/'
}

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
  readonly conf: config.NomadConfig;

  constructor(environment: string | config.NomadConfig = 'development') {
    super();

    const conf: config.NomadConfig =
      typeof environment === 'string'
        ? config.getBuiltin(environment)
        : environment;

    config.validateConfig(conf);
    this.conf = conf;

    const domains = conf.networks.map(
      (network) => conf.protocol.networks[network],
    );
    domains.forEach((domain) => this.registerDomain(domain));
    this._cores = new Map();
    const cores = conf.networks.map(
      (network) => new CoreContracts(this, network, conf.core[network]),
    );
    cores.forEach((core) => {
      this._cores.set(core.domain, core);
    });
    this._blacklist = new Set();
  }

  get governor(): config.NomadLocator {
    return this.conf.protocol.governor;
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
  async governorCore(): Promise<CoreContracts<this>> {
    return this.mustGetCore(this.governor.domain);
  }

  /**
   * Proves and Processes a transaction on the destination chain. This is subsidize and
   * automatic on non-Ethereum destinations
   * 
   * @dev Ensure that a transaction is ready to be processed. You should ensure the following
   * criteria have been met prior to calling this function:
   *  1. the tx has been relayed
   *  2. the `confirmAt` timestamp for the tx is in the past
   *  3. the user is on the destination chain in their wallet
   *
   * @returns The Contract Transaction receipt
   */
  async process(origin: string | number, txId: string): Promise<ContractTransaction>{
    // get s3 proof URL for environment
    const { environment } = this.conf
    const s3URL = s3URLs[environment]

    const message = (await NomadMessage.baseFromTransactionHash(
      this,
      origin,
      txId
    ))[0]

    const originNetwork = this.resolveDomainName(message.origin)
    const destNetwork = this.resolveDomainName(message.destination)
    const index = message.leafIndex.toString()
    const s3Res = await fetch(`${s3URL}${originNetwork}_${index}`)
    const data = (await s3Res.json()) as any

    // get replica contract
    const replica = this.getReplicaFor(originNetwork, destNetwork)
    if (!replica) throw new Error('missing replica, unable to process transaction')

    // get signer and connect replica
    const signer = this.getSigner(destNetwork)
    if (!signer) throw new Error('missing signer, unable to process transaction')
    replica.connect(signer)

    return await replica.proveAndProcess(
      data.message,
      data.proof.path,
      data.proof.index
    )
  }

  blacklist(): Set<number> {
    return this._blacklist;
  }

  async checkHomes(networks: (string | number)[]): Promise<void> {
    networks.forEach(async (n) => await this.checkHome(n));
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
}
