import { Result } from '@ethersproject/abi';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { TypedEvent } from '@nomad-xyz/contracts-core';

export class Annotated<U extends Result, T extends TypedEvent<U>> {
  readonly domain: number;
  readonly eventName?: string;
  readonly event: T;
  readonly receipt: TransactionReceipt;
  constructor(
    domain: number,
    receipt: TransactionReceipt,
    event: T,
    callerKnowsWhatTheyAreDoing = false,
  ) {
    if (!callerKnowsWhatTheyAreDoing) {
      throw new Error('Please instantiate using fromEvent or fromEvents');
    }

    this.domain = domain;
    this.receipt = receipt;
    this.eventName = event.eventSignature?.split('(')[0];
    this.event = event;
  }

  static async fromEvent<U extends Result, T extends TypedEvent<U>>(
    domain: number,
    event: T,
  ): Promise<Annotated<U, T>> {
    const receipt = await event.getTransactionReceipt();
    return new Annotated(domain, receipt, event, true);
  }

  static async fromEvents<U extends Result, T extends TypedEvent<U>>(
    domain: number,
    events: T[],
  ): Promise<Annotated<U, T>[]> {
    return Promise.all(
      events.map(async (event) => Annotated.fromEvent(domain, event)),
    );
  }

  get contractAddress(): string {
    // ok to use ! assertion here as we assume that the event is in the receipt
    const address = this.receipt.logs.find(
      (log) => log.logIndex === this.event.logIndex,
    )?.address;
    if (!address)
      throw new Error('Missing receipt. Class is in an inconsistent state');
    return address;
  }

  get transactionHash(): string {
    return this.receipt.transactionHash;
  }

  get blockNumber(): number {
    return this.receipt.blockNumber;
  }

  get blockHash(): string {
    return this.receipt.blockHash;
  }
}

export type {
  AnnotatedDispatch,
  AnnotatedUpdate,
  AnnotatedProcess,
  AnnotatedLifecycleEvent,
  NomadLifecyleEvent,
  DispatchEvent,
  ProcessEvent,
  UpdateEvent,
  UpdateArgs,
  UpdateTypes,
  ProcessArgs,
  ProcessTypes,
  DispatchArgs,
  DispatchTypes,
} from './nomadEvents';

export * from './fetch';
