import { ethers } from 'ethers';

import { MultiProvider } from '@nomad-xyz/multi-provider';
import * as core from '@nomad-xyz/contracts-core';
import * as config from '@nomad-xyz/config';

import { CoreContracts } from './CoreContracts';

export type Address = string;

/**
 * The NomadContext managers connections to Nomad core and Bridge contracts.
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
  protected cores: Map<string, CoreContracts>;
  protected _blacklist: Set<number>;
  readonly conf: config.NomadConfig;

  constructor(conf: config.NomadConfig) {
    super();
    this.conf = conf;

    const domains = conf.networks.map(
      (network) => conf.protocol.networks[network],
    );
    domains.forEach((domain) => this.registerDomain(domain));
    this.cores = new Map();
    const cores = conf.networks.map((network) =>
      CoreContracts.fromConfig(network, conf.core[network]),
    );
    cores.forEach((core) => {
      this.cores.set(core.domain, core);
    });
    this._blacklist = new Set();
  }

  get governor(): config.NomadLocator {
    return this.conf.protocol.governor;
  }

  /**
   * Ensure that the contracts on a given domain are connected to the
   * currently-registered signer or provider.
   *
   * @param domain the domain to reconnect
   */
  protected reconnect(nameOrDomain: string | number): void {
    const domain = this.resolveDomainName(nameOrDomain);
    const connection = this.getConnection(domain);
    if (!connection) {
      throw new Error(`Reconnect failed: no connection for ${domain}`);
    }
    // re-register contracts
    const core = this.cores.get(domain);
    if (core) {
      core.connect(connection);
    }
  }

  /**
   * Register an ethers Provider for a specified domain.
   *
   * @param nameOrDomain A domain name or number.
   * @param provider An ethers Provider to be used by requests to that domain.
   */
  registerProvider(
    nameOrDomain: string | number,
    provider: ethers.providers.Provider,
  ): void {
    const domain = this.resolveDomain(nameOrDomain);
    super.registerProvider(domain, provider);
    this.reconnect(domain);
  }

  /**
   * Register an ethers Signer for a specified domain.
   *
   * @param nameOrDomain A domain name or number.
   * @param signer An ethers Signer to be used by requests to that domain.
   */
  registerSigner(nameOrDomain: string | number, signer: ethers.Signer): void {
    const domain = this.resolveDomain(nameOrDomain);
    super.registerSigner(domain, signer);
    this.reconnect(domain);
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
    this.reconnect(domain);
  }

  /**
   * Clear all signers from all registered domains.
   */
  clearSigners(): void {
    super.clearSigners();
    this.domainNumbers.forEach((domain) => this.reconnect(domain));
  }

  /**
   * Get the {@link CoreContracts} for a given domain (or undefined)
   *
   * @param nameOrDomain A domain name or number.
   * @returns a {@link CoreContracts} object (or undefined)
   */
  getCore(nameOrDomain: string | number): CoreContracts | undefined {
    const domain = this.resolveDomainName(nameOrDomain);
    return this.cores.get(domain);
  }

  /**
   * Get the {@link CoreContracts} for a given domain (or throw an error)
   *
   * @param nameOrDomain A domain name or number.
   * @returns a {@link CoreContracts} object
   * @throws if no {@link CoreContracts} object exists on that domain.
   */
  mustGetCore(nameOrDomain: string | number): CoreContracts {
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
    const homeDomain = this.resolveDomainName(home);
    return this.getCore(remote)?.getReplica(homeDomain);
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
  async governorCore(): Promise<CoreContracts> {
    return this.mustGetCore(this.governor.domain);
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
