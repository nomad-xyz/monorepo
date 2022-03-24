import { ethers } from 'ethers';
import { Contracts } from '@nomad-xyz/multi-provider';
import {
  BridgeRouter,
  TokenRegistry,
  ETHHelper,
  TokenRegistry__factory,
  BridgeRouter__factory,
  ETHHelper__factory,
} from '@nomad-xyz/contracts-bridge';
import * as config from '@nomad-xyz/configuration';

export class BridgeContracts extends Contracts {
  readonly domain: string;
  protected conf: config.BridgeContracts;

  private providerOrSigner?: ethers.providers.Provider | ethers.Signer;

  constructor(
    domain: string,
    conf: config.BridgeContracts,
    providerOrSigner?: ethers.providers.Provider | ethers.Signer,
  ) {
    super(domain, conf, providerOrSigner);
    this.domain = domain;
    this.conf = conf;
    this.providerOrSigner = providerOrSigner;
  }

  get deployHieght(): number {
    return this.conf.deployHeight;
  }

  get bridgeRouter(): BridgeRouter {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return BridgeRouter__factory.connect(
      this.conf.bridgeRouter.proxy,
      this.providerOrSigner,
    );
  }

  get tokenRegistry(): TokenRegistry {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    return TokenRegistry__factory.connect(
      this.conf.tokenRegistry.proxy,
      this.providerOrSigner,
    );
  }

  get ethHelper(): ETHHelper | undefined {
    if (!this.providerOrSigner) {
      throw new Error('No provider or signer. Call `connect` first.');
    }
    if (!this.conf.ethHelper) return;
    return ETHHelper__factory.connect(
      this.conf.ethHelper,
      this.providerOrSigner,
    );
  }

  connect(providerOrSigner: ethers.providers.Provider | ethers.Signer): void {
    this.providerOrSigner = providerOrSigner;
  }
}
