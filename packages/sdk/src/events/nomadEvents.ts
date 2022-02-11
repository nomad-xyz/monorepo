import { BigNumber } from '@ethersproject/bignumber';
import { TypedEvent } from '@nomad-xyz/core-contracts';

import { Annotated } from '.';

// copied from Home.d.ts
export type DispatchTypes = [string, BigNumber, BigNumber, string, string];
export type DispatchArgs = {
  messageHash: string;
  leafIndex: BigNumber;
  destinationAndNonce: BigNumber;
  committedRoot: string;
  message: string;
};
export type DispatchEvent = TypedEvent<DispatchTypes & DispatchArgs>;

// copied from Home.d.ts
export type UpdateTypes = [number, string, string, string];
export type UpdateArgs = {
  homeDomain: number;
  oldRoot: string;
  newRoot: string;
  signature: string;
};
export type UpdateEvent = TypedEvent<UpdateTypes & UpdateArgs>;

// copied from Replica.d.ts
export type ProcessTypes = [string, boolean, string];
export type ProcessArgs = {
  messageHash: string;
  success: boolean;
  returnData: string;
};
export type ProcessEvent = TypedEvent<ProcessTypes & ProcessArgs>;

export type NomadLifecyleEvent = ProcessEvent | UpdateEvent | DispatchEvent;

export type AnnotatedDispatch = Annotated<DispatchTypes, DispatchEvent>;
export type AnnotatedUpdate = Annotated<UpdateTypes, UpdateEvent>;
export type AnnotatedProcess = Annotated<ProcessTypes, ProcessEvent>;

export type AnnotatedLifecycleEvent =
  | AnnotatedDispatch
  | AnnotatedUpdate
  | AnnotatedProcess;
