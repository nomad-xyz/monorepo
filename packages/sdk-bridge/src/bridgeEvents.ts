import { TypedEvent } from '../../contracts-core';
import { BigNumber } from 'ethers';
import { Annotated } from '@nomad-xyz/sdk';

export type SendTypes = [string, string, number, string, BigNumber, boolean];
export type SendArgs = {
  token: string;
  from: string;
  toDomain: number;
  toId: string;
  amount: BigNumber;
  fastLiquidity: boolean;
};
export type SendEvent = TypedEvent<SendTypes & SendArgs>;

export type ReceiveTypes = [BigNumber, string, string, string, BigNumber];
export type ReceiveArgs = {
  originAndNonce: BigNumber;
  token: string;
  recipient: string;
  liquidityProvider: string;
  amount: BigNumber;
};
export type ReceiveEvent = TypedEvent<ReceiveTypes & ReceiveArgs>;

export type TokenDeployedTypes = [number, string, string];
export type TokenDeployedArgs = {
  domain: number;
  id: string;
  representation: string;
};
export type TokenDeployedEvent = TypedEvent<
  TokenDeployedTypes & TokenDeployedArgs
>;

export type AnnotatedSend = Annotated<SendTypes, SendEvent>;
export type AnnotatedReceive = Annotated<ReceiveTypes, ReceiveEvent>;
export type AnnotatedTokenDeployed = Annotated<
  TokenDeployedTypes,
  TokenDeployedEvent
>;
