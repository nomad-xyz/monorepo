import { providers, Signer, BigNumber, ContractTransaction } from 'ethers';

import { MultiProvider } from '@nomad-xyz/multi-provider';
import * as core from '@nomad-xyz/contracts-core';
import * as config from '@nomad-xyz/configuration';

import { CoreContracts } from './CoreContracts';

export type Address = string;

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
    this._cores = new Map();
    this._blacklist = new Set();

    for (const network of this.conf.networks) {
      // register domain
      this.registerDomain(this.conf.protocol.networks[network]);
      // register RPC provider
      if (this.conf.rpcs[network] && this.conf.rpcs[network].length > 0) {
        this.registerRpcProvider(network, this.conf.rpcs[network][0]);
      }
      // set core contracts
      const core = new CoreContracts(this, network, this.conf.core[network])
      this._cores.set(core.domain, core);
    }
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
  governorCore(): CoreContracts<this> {
    return this.mustGetCore(this.governor.domain);
  }

  async process(txId: string): Promise<ContractTransaction>{
    const isProduction = this.conf.environment === 'production'
    const nomadAPI = isProduction
      ? 'https://bridge-indexer.prod.madlads.tools/tx/'
      : 'https://bridge-indexer.dev.madlads.tools/tx/'
    const s3URL = isProduction
      ? 'https://nomadxyz-production-proofs.s3.us-west-2.amazonaws.com/'
      : 'https://nomadxyz-development-proofs.s3.us-west-2.amazonaws.com/'

    // get transfer message
    const res = await fetch(`${nomadAPI}${txId}`)
    const tx = (await res.json())[0] as any

    // get proof
    const index = BigNumber.from(tx.leafIndex).toNumber()
    const originName = this.resolveDomainName(tx.origin)
    const s3Res = await fetch(`${s3URL}${originName}_${index}`)
    const data = (await s3Res.json()) as any
    console.log('proof: ', data)

    // get replica contract
    const replica = this.getReplicaFor(tx.origin, tx.destination)

    if (!replica) throw new Error('missing replica, unable to process transaction')

    // get signer and connect replica
    const signer = this.getSigner(tx.destination)
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
