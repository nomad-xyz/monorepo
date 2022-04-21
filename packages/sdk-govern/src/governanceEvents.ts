import { BigNumber } from '@ethersproject/bignumber';
import { TypedEvent } from '@nomad-xyz/contracts-core';
import { Annotated } from '@nomad-xyz/sdk';

// copied from GovernanceRouter.d.ts
export type BatchReceivedTypes = [string];
export type BatchReceivedArgs = { batchHash: string };
export type BatchReceivedEvent = TypedEvent<
  BatchReceivedTypes & BatchReceivedArgs
>;

// copied from GovernanceRouter.d.ts
export type BatchExecutedTypes = [string];
export type BatchExecutedArgs = { batchHash: string };
export type BatchExecutedEvent = TypedEvent<
  BatchExecutedTypes & BatchExecutedArgs
>;

// copied from GovernanceRouter.d.ts
export type ExitRecoveryTypes = [string];
export type ExitRecoveryArgs = { recoveryManager: string };
export type ExitRecoveryEvent = TypedEvent<
  ExitRecoveryTypes & ExitRecoveryArgs
>;

// copied from GovernanceRouter.d.ts
export type InitiateRecoveryTypes = [string, BigNumber];
export type InitiateRecoveryArgs = {
  recoveryManager: string;
  recoveryActiveAt: BigNumber;
};
export type InitiateRecoveryEvent = TypedEvent<
  InitiateRecoveryTypes & InitiateRecoveryArgs
>;

// copied from GovernanceRouter.d.ts
export type SetRouterTypes = [number, string, string];
export type SetRouterArgs = {
  domain: number;
  previousRouter: string;
  newRouter: string;
};
export type SetRouterEvent = TypedEvent<SetRouterTypes & SetRouterArgs>;

// copied from GovernanceRouter.d.ts
export type TransferGovernorTypes = [number, number, string, string];
export type TransferGovernorArgs = {
  previousGovernorDomain: number;
  newGovernorDomain: number;
  previousGovernor: string;
  newGovernor: string;
};
export type TransferGovernorEvent = TypedEvent<
  TransferGovernorTypes & TransferGovernorArgs
>;

// copied from GovernanceRouter.d.ts
export type TransferRecoveryManagerTypes = [string, string];
export type TransferRecoveryManagerArgs = {
  previousRecoveryManager: string;
  newRecoveryManager: string;
};
export type TransferRecoveryManagerEvent = TypedEvent<
  TransferRecoveryManagerTypes & TransferRecoveryManagerArgs
>;

export type GovernanceEvent =
  | BatchReceivedEvent
  | BatchExecutedEvent
  | ExitRecoveryEvent
  | InitiateRecoveryEvent
  | SetRouterEvent
  | TransferGovernorEvent
  | TransferRecoveryManagerEvent;

export type AnnotatedBatchReceived = Annotated<
  BatchReceivedTypes,
  BatchReceivedEvent
>;
export type AnnotatedBatchExecuted = Annotated<
  BatchExecutedTypes,
  BatchExecutedEvent
>;
export type AnnotatedExitRecovery = Annotated<
  ExitRecoveryTypes,
  ExitRecoveryEvent
>;
export type AnnotatedInitiateRecovery = Annotated<
  InitiateRecoveryTypes,
  InitiateRecoveryEvent
>;
export type AnnotatedSetRouter = Annotated<SetRouterTypes, SetRouterEvent>;
export type AnnotatedTransferGovernor = Annotated<
  TransferGovernorTypes,
  TransferGovernorEvent
>;
export type AnnotatedTransferRecoveryManager = Annotated<
  TransferRecoveryManagerTypes,
  TransferRecoveryManagerEvent
>;

export type AnnotatedGovernanceEvent =
  | AnnotatedBatchReceived
  | AnnotatedBatchExecuted
  | AnnotatedExitRecovery
  | AnnotatedInitiateRecovery
  | AnnotatedSetRouter
  | AnnotatedTransferGovernor
  | AnnotatedTransferRecoveryManager;
