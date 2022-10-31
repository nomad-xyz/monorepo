import { BigNumber } from '@ethersproject/bignumber';

// copied from Home.d.ts
export type Dispatch = {
  args: {
    messageHash: string;
    leafIndex: BigNumber;
    destinationAndNonce: BigNumber;
    committedRoot: string;
    message: string;
  };
  transactionHash: string;
};

export type ParsedMessage = {
  from: number;
  sender: string;
  nonce: number;
  destination: number;
  recipient: string;
  body: string;
};

export enum MessageStatus {
  Dispatched = 0,
  Included,
  Relayed,
  Received,
  Processed,
}

export enum ReplicaStatusNames {
  None = 'none',
  Proven = 'proven',
  Processed = 'processed',
}

type ReplicaMessageStatusNone = {
  status: ReplicaStatusNames.None;
};

type ReplicaMessageStatusProcess = {
  status: ReplicaStatusNames.Processed;
};

type ReplicaMessageStatusProven = {
  status: ReplicaStatusNames.Proven;
  root: string;
};

export type ReplicaMessageStatus =
  | ReplicaMessageStatusNone
  | ReplicaMessageStatusProcess
  | ReplicaMessageStatusProven;
