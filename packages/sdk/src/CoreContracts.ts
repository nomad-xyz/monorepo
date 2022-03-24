import { ethers } from 'ethers';
import * as core from '@nomad-xyz/contracts-core';
import * as config from '@nomad-xyz/configuration';
import { Contracts } from '@nomad-xyz/multi-provider';

export type LocalGovernor = {
  location: 'local';
  identifier: string;
};

export type RemoteGovernor = {
  location: 'remote';
  domain: number;
};

export type Governor = LocalGovernor | RemoteGovernor;

export class CoreContracts extends Contracts {
  readonly domain: string;
  protected conf: config.CoreContracts;

  private _governor?: Governor;
  private providerOrSigner?: ethers.providers.Provider | ethers.Signer;

  constructor(
    domain: string,
    conf: config.CoreContracts,
    providerOrSigner?: ethers.providers.Provider | ethers.Signer,
  ) {
    super(domain, conf, providerOrSigner);
    this.providerOrSigner = providerOrSigner;
    this.domain = domain;
    this.conf = conf;
  }

  getReplica(domain: string): core.Replica | undefined {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    const replica = this.conf.replicas[domain];
    if (!replica) return;
    return core.Replica__factory.connect(replica.proxy, this.providerOrSigner);
  }

  get deployHeight(): number {
    return this.conf.deployHeight;
  }

  get home(): core.Home {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return core.Home__factory.connect(
      this.conf.home.proxy,
      this.providerOrSigner,
    );
  }

  get governanceRouter(): core.GovernanceRouter {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return core.GovernanceRouter__factory.connect(
      this.conf.governanceRouter.proxy,
      this.providerOrSigner,
    );
  }

  get xAppConnectionManager(): core.XAppConnectionManager {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return core.XAppConnectionManager__factory.connect(
      this.conf.xAppConnectionManager,
      this.providerOrSigner,
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

  connect(providerOrSigner: ethers.providers.Provider | ethers.Signer): void {
    this.providerOrSigner = providerOrSigner;
  }
}
