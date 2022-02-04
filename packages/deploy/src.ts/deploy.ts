import { ethers } from 'ethers';
import { Chain, Eip1559Pricing } from './chain';
import { Contracts } from './contracts';

type XAppConnectionName = 'XAppConnectionManager';
type UpdaterManagerName = 'UpdaterManager';
type UBCName = 'UpgradeBeaconController';
type HomeName = 'Home UpgradeBeacon' | 'Home Proxy' | 'Home Implementation';
type ReplicaName =
  | 'Replica UpgradeBeacon'
  | 'Replica Proxy'
  | 'Replica Implementation';
type GovernanceName =
  | 'Governance UpgradeBeacon'
  | 'Governance Proxy'
  | 'Governance Implementation';
type EthHelperName = 'ETH Helper';
type BridgeTokenName =
  | 'BridgeToken UpgradeBeacon'
  | 'BridgeToken Proxy'
  | 'BridgeToken Implementation';
type BridgeRouterName =
  | 'BridgeRouter UpgradeBeacon'
  | 'BridgeRouter Proxy'
  | 'BridgeRouter Implementation';
type TokenRegistryName =
  | 'TokenRegistry UpgradeBeacon'
  | 'TokenRegistry Proxy'
  | 'TokenRegistry Implementation';

export type ContractVerificationName =
  | XAppConnectionName
  | UpdaterManagerName
  | UBCName
  | HomeName
  | ReplicaName
  | GovernanceName
  | EthHelperName
  | BridgeTokenName
  | TokenRegistryName
  | BridgeRouterName;

export type ContractVerificationInput = {
  name: ContractVerificationName;
  address: string;
  constructorArguments: any[];
  isProxy?: boolean;
};

export abstract class Deploy<T extends Contracts> {
  readonly chain: Chain;
  readonly test: boolean;
  contracts: T;
  verificationInput: ContractVerificationInput[];

  private _overrides: ethers.Overrides | undefined;

  abstract get ubcAddress(): string | undefined;

  constructor(chain: Chain, contracts: T, test = false) {
    this.chain = chain;
    this.verificationInput = [];
    this.test = test;
    this.contracts = contracts;
  }

  get deployer(): ethers.Signer {
    return this.chain.deployer;
  }

  async ready(): Promise<ethers.providers.Network> {
    return await this.provider.ready;
  }

  get provider(): ethers.providers.JsonRpcProvider {
    return this.chain.provider;
  }

  get supports1559(): boolean {
    const notSupported = ['kovan', 'alfajores', 'baklava', 'celo'];
    return notSupported.indexOf(this.chain.name) === -1;
  }

  // this is currently a kludge to account for ethers issues
  get overrides(): ethers.Overrides {
    // check cache
    if (this._overrides) {
      return this._overrides;
    }

    const { limit, price } = this.chain.gas;
    // we use 1559 if the network supports it and the config does not specify gasPrice
    const { supports1559 } = this;
    const use1559 = supports1559 && !ethers.BigNumber.isBigNumber(price);

    if (!supports1559 && use1559) {
      throw new Error(
        'Received eip1559 fees for network that does not support 1559',
      );
    }

    let overrides: ethers.Overrides;
    if (use1559) {
      const { maxFeePerGas, maxPriorityFeePerGas } = price as Eip1559Pricing;
      overrides = {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: limit,
      };
    } else {
      overrides = {
        type: 0,
        // checked by error block above
        gasPrice: this.chain.gas.price as ethers.BigNumber,
        gasLimit: this.chain.gas.limit,
      };
    }

    // cache
    this._overrides = overrides;
    return overrides;
  }
}
