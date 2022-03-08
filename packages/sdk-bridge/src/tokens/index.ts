import { BytesLike } from 'ethers';
import * as bridge from '@nomad-xyz/contracts-bridge';
import wellKnown from './wellKnown';
import testnetWellKnown from './testnetWellKnown';

export interface TokenIdentifier {
  domain: string | number;
  id: BytesLike;
}

export type ResolvedTokenInfo = {
  // The canonical domain
  domain: number;
  // The canonical identifier
  id: BytesLike;
  // The contract on each chain
  tokens: Map<number, bridge.BridgeToken>;
};

export const tokens = wellKnown;
export const testnetTokens = testnetWellKnown;
