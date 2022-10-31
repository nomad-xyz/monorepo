import { Contracts, NoProviderError } from '@nomad-xyz/multi-provider';
import {
  BridgeRouter,
  TokenRegistry,
  ETHHelper,
  NFTAccountant,
  TokenRegistry__factory,
  BridgeRouter__factory,
  ETHHelper__factory,
  NftAccountant__factory,
} from '@nomad-xyz/contracts-bridge';
import * as config from '@nomad-xyz/configuration';
import { BridgeContext } from './BridgeContext';
import { BigNumber, BigNumberish } from 'ethers';

export interface NftInfo {
  _holder: string;
  _isAllowed: boolean;
  _uri: string;
  _asset: string;
  _originalAmount: BigNumber;
  _originalUser: string;
  _recovered: BigNumber;
  _recoverable: BigNumber;
}

export interface AccountantAsset {
  _totalAffected: BigNumber;
  _totalMinted: BigNumber;
  _totalCollected: BigNumber;
  _totalRecovered: BigNumber;
}

export class BridgeContracts extends Contracts<config.Domain, BridgeContext> {
  protected conf: config.BridgeContracts;

  constructor(
    context: BridgeContext,
    domain: string,
    conf: config.BridgeContracts,
  ) {
    super(context, domain, conf);
    this.conf = conf;
  }

  get deployHeight(): number {
    return this.conf.deployHeight;
  }

  /**
   * Get the BridgeRouter associated with this bridge.
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @throws if there is no connection for this network
   */
  get bridgeRouter(): BridgeRouter {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    return BridgeRouter__factory.connect(
      this.conf.bridgeRouter.proxy,
      this.connection,
    );
  }

  /**
   * Get the TokenRegistry associated with this bridge.
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @throws if there is no connection for this network
   */
  get tokenRegistry(): TokenRegistry {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    return TokenRegistry__factory.connect(
      this.conf.tokenRegistry.proxy,
      this.connection,
    );
  }

  /**
   * Get the EthHelper associated with this bridge (if any).
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @throws if there is no connection for this network
   */
  get ethHelper(): ETHHelper | undefined {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    if (!this.conf.ethHelper) return;
    return ETHHelper__factory.connect(this.conf.ethHelper, this.connection);
  }

  /**
   * Get the Accountant associated with this bridge (if any).
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @throws if there is no connection for this network
   */
  get accountant(): NFTAccountant | undefined {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    if (!this.conf.accountant) return;
    return NftAccountant__factory.connect(
      this.conf.accountant,
      this.connection,
    );
  }

  /**
   * Get the info associated with the NFT ID, if any.
   *
   * @param id The numerical NFT ID
   * @throws if there is no connection for this network
   */
  async nftInfo(id: BigNumberish): Promise<NftInfo | undefined> {
    const info = await this.accountant?.info(id);
    if (!info || info._originalAmount.isZero()) {
      return;
    }
    return info;
  }

  /**
   * Get the info associated with the NFT ID, if any.
   *
   * @param id The numerical NFT ID
   * @throws if there is no connection for this network
   */
  async assetInfo(token: string): Promise<AccountantAsset | undefined> {
    const info = await this.accountant?.assetInfo(token);
    if (!info || info._totalAffected.isZero()) {
      return;
    }
    return info;
  }
}
