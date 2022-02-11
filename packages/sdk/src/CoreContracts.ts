import { ethers } from 'ethers';
import * as core from '@nomad-xyz/core-contracts';
import { Contracts } from '@nomad-xyz/multi-provider';
import { ReplicaInfo } from './domains/domain';

type Address = string;

type InternalReplica = {
  domain: number;
  address: Address;
};

interface Core {
  id: number;
  home: Address;
  replicas: ReplicaInfo[];
  governanceRouter: Address;
  xAppConnectionManager: Address;
}

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
  readonly domain: number;
  readonly _home: Address;
  readonly _replicas: Map<number, InternalReplica>;
  readonly governanceRouterAddress: Address;
  readonly xAppConnectionManagerAddress: Address;
  private providerOrSigner?: ethers.providers.Provider | ethers.Signer;
  private _governor?: Governor;

  constructor(
    domain: number,
    home: Address,
    replicas: ReplicaInfo[],
    governaceRouter: Address,
    xAppConnectionManager: Address,
    providerOrSigner?: ethers.providers.Provider | ethers.Signer,
  ) {
    super(domain, home, replicas, providerOrSigner);
    this.providerOrSigner = providerOrSigner;
    this.domain = domain;
    this._home = home;
    this.governanceRouterAddress = governaceRouter;
    this.xAppConnectionManagerAddress = xAppConnectionManager;

    this._replicas = new Map();
    replicas.forEach((replica) => {
      this._replicas.set(replica.domain, {
        address: replica.address,
        domain: replica.domain,
      });
    });
  }

  getReplica(domain: number): core.Replica | undefined {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    const replica = this._replicas.get(domain);
    if (!replica) return;
    return core.Replica__factory.connect(
      replica.address,
      this.providerOrSigner,
    );
  }

  get home(): core.Home {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return core.Home__factory.connect(this._home, this.providerOrSigner);
  }

  get governanceRouter(): core.GovernanceRouter {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return core.GovernanceRouter__factory.connect(
      this.governanceRouterAddress,
      this.providerOrSigner,
    );
  }

  get xAppConnectionManager(): core.XAppConnectionManager {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return core.XAppConnectionManager__factory.connect(
      this.xAppConnectionManagerAddress,
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

  toObject(): Core {
    const replicas: ReplicaInfo[] = Array.from(this._replicas.values()).map(
      (replica) => {
        return {
          domain: replica.domain,
          address: replica.address,
        };
      },
    );

    return {
      id: this.domain,
      home: this._home,
      replicas: replicas,
      governanceRouter: this.governanceRouterAddress,
      xAppConnectionManager: this.xAppConnectionManagerAddress,
    };
  }

  static fromObject(data: Core, signer?: ethers.Signer): CoreContracts {
    const { id, home, replicas, governanceRouter, xAppConnectionManager } =
      data;
    if (!id || !home || !replicas) {
      throw new Error('Missing key');
    }
    return new CoreContracts(
      id,
      home,
      replicas,
      governanceRouter,
      xAppConnectionManager,
      signer,
    );
  }
}
