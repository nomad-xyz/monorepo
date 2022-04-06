import { Contracts, NoProviderError } from '@nomad-xyz/multi-provider';
import {
  BridgeRouter,
  TokenRegistry,
  ETHHelper,
  TokenRegistry__factory,
  BridgeRouter__factory,
  ETHHelper__factory,
} from '@nomad-xyz/contracts-bridge';
import * as config from '@nomad-xyz/configuration';
import { BridgeContext } from './BridgeContext';

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

  get bridgeRouter(): BridgeRouter {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    return BridgeRouter__factory.connect(
      this.conf.bridgeRouter.proxy,
      this.connection,
    );
  }

  get tokenRegistry(): TokenRegistry {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    return TokenRegistry__factory.connect(
      this.conf.tokenRegistry.proxy,
      this.connection,
    );
  }

  get ethHelper(): ETHHelper | undefined {
    if (!this.connection) throw new NoProviderError(this.context, this.domain);
    if (!this.conf.ethHelper) return;
    return ETHHelper__factory.connect(this.conf.ethHelper, this.connection);
  }
}
