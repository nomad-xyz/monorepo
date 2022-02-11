import { ethers } from 'ethers';
import { Contracts } from '@nomad-xyz/multi-provider/lib/contracts';
import {
  BridgeRouter,
  TokenRegistry,
  ETHHelper,
  TokenRegistry__factory,
  BridgeRouter__factory,
  ETHHelper__factory,
} from '@nomad-xyz/bridge-contracts';

type Address = string;

interface ProxyInfo {
  proxy: Address;
}

interface BridgeInfo {
  id: number;
  bridgeRouter: Address | ProxyInfo;
  tokenRegistry: Address | ProxyInfo;
  ethHelper?: Address;
}

export class BridgeContracts extends Contracts {
  domain: number;
  readonly _bridgeRouter: Address;
  readonly _tokenRegistry: Address;
  readonly _ethHelper?: Address;
  private providerOrSigner?: ethers.providers.Provider | ethers.Signer;

  constructor(
    domain: number,
    bridgeRouter: Address,
    tokenRegistry: Address,
    ethHelper?: Address,
    providerOrSigner?: ethers.providers.Provider | ethers.Signer,
  ) {
    super(domain, bridgeRouter, ethHelper, providerOrSigner);
    this.providerOrSigner = providerOrSigner;
    this.domain = domain;

    this._bridgeRouter = bridgeRouter;
    this._tokenRegistry = tokenRegistry;
    if (ethHelper) {
      this._ethHelper = ethHelper;
    }
  }

  get bridgeRouter(): BridgeRouter {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return BridgeRouter__factory.connect(
      this._bridgeRouter,
      this.providerOrSigner,
    );
  }

  get tokenRegistry(): TokenRegistry {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return TokenRegistry__factory.connect(
      this._tokenRegistry,
      this.providerOrSigner,
    );
  }

  get ethHelper(): ETHHelper | undefined {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    if (!this._ethHelper) return;
    return ETHHelper__factory.connect(this._ethHelper, this.providerOrSigner);
  }

  connect(providerOrSigner: ethers.providers.Provider | ethers.Signer): void {
    this.providerOrSigner = providerOrSigner;
  }

  static fromObject(
    data: BridgeInfo,
    providerOrSigner?: ethers.providers.Provider | ethers.Signer,
  ): BridgeContracts {
    const { id, bridgeRouter, tokenRegistry, ethHelper } = data;
    if (!id || !bridgeRouter) {
      throw new Error('missing domain or bridgeRouter address');
    }
    const router =
      typeof bridgeRouter === 'string' ? bridgeRouter : bridgeRouter.proxy;
    const registry =
      typeof tokenRegistry === 'string' ? tokenRegistry : tokenRegistry.proxy;
    return new BridgeContracts(
      id,
      router,
      registry,
      ethHelper,
      providerOrSigner,
    );
  }

  toObject(): BridgeInfo {
    const bridge: BridgeInfo = {
      id: this.domain,
      bridgeRouter: this.bridgeRouter.address,
      tokenRegistry: this.tokenRegistry.address,
    };
    if (this.ethHelper) {
      bridge.ethHelper = this.ethHelper.address;
    }
    return bridge;
  }
}
