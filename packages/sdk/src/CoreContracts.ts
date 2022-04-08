import { ethers } from 'ethers';
import * as core from '@nomad-xyz/contracts-core';
import * as config from '@nomad-xyz/configuration';
import { Contracts, NoProviderError } from '@nomad-xyz/multi-provider';
import { NomadContext } from './NomadContext';

export type LocalGovernor = {
  location: 'local';
  identifier: string;
};

export type RemoteGovernor = {
  location: 'remote';
  domain: number;
};

export type Governor = LocalGovernor | RemoteGovernor;

export class CoreContracts<T extends NomadContext> extends Contracts<
  config.Domain,
  NomadContext
> {
  protected conf: config.CoreContracts;

  private _governor?: Governor;

  constructor(context: T, domain: string, conf: config.CoreContracts) {
    super(context, domain, conf);
    this.conf = conf;
  }

  /**
   * Resolves Replica with given domain
   *
   * @param nameOrDomain The name or domain ID of the Replica
   * @returns An interface for the Replica, undefined if not found
   */
  getReplica(nameOrDomain: string | number): core.Replica | undefined {
    const domain = this.context.resolveDomain(nameOrDomain);
    if (!this.connection) throw new NoProviderError(this.context, domain);
    const replica = this.conf.replicas[domain];
    if (!replica) return;
    return core.Replica__factory.connect(replica.proxy, this.connection);
  }

  get deployHeight(): number {
    return this.conf.deployHeight;
  }

  get home(): core.Home {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    return core.Home__factory.connect(this.conf.home.proxy, this.connection);
  }

  get governanceRouter(): core.GovernanceRouter {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    return core.GovernanceRouter__factory.connect(
      this.conf.governanceRouter.proxy,
      this.connection,
    );
  }

  get xAppConnectionManager(): core.XAppConnectionManager {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    return core.XAppConnectionManager__factory.connect(
      this.conf.xAppConnectionManager,
      this.connection,
    );
  }

  async governor(): Promise<Governor> {
    if (this._governor) {
      return this._governor;
    }
    const [domain, identifier] = await Promise.all([
      this.governanceRouter.governorDomain(),
      this.governanceRouter.governor(),
    ]);
    if (identifier === ethers.constants.AddressZero) {
      this._governor = { location: 'remote', domain };
    } else {
      this._governor = { location: 'local', identifier };
    }
    return this._governor;
  }
}
