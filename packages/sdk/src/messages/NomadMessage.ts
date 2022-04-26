import { ContractTransaction } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber';
import { arrayify, hexlify } from '@ethersproject/bytes';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import * as core from '@nomad-xyz/contracts-core';
import { NomadContext } from '..';
import { utils } from '@nomad-xyz/multi-provider';
import { Logger } from '@ethersproject/logger';

import {
  DispatchEvent,
  AnnotatedDispatch,
  AnnotatedUpdate,
  AnnotatedProcess,
  UpdateTypes,
  UpdateArgs,
  ProcessTypes,
  ProcessArgs,
  AnnotatedLifecycleEvent,
  Annotated,
  DispatchTypes,
} from '../events';

import { queryAnnotatedEvents } from '..';
import { keccak256 } from 'ethers/lib/utils';

export type ParsedMessage = {
  from: number;
  sender: string;
  nonce: number;
  destination: number;
  recipient: string;
  body: string;
};

export type NomadStatus = {
  status: MessageStatus;
  events: AnnotatedLifecycleEvent[];
};

export enum MessageStatus {
  Dispatched = 0,
  Included = 1,
  Relayed = 2,
  Processed = 3,
}

export enum ReplicaMessageStatus {
  None = 0,
  Proven,
  Processed,
}

export type EventCache = {
  homeUpdate?: AnnotatedUpdate;
  replicaUpdate?: AnnotatedUpdate;
  process?: AnnotatedProcess;
};

/**
 * Parse a serialized Nomad message from raw bytes.
 *
 * @param message
 * @returns
 */
export function parseMessage(message: string): ParsedMessage {
  const buf = Buffer.from(arrayify(message));
  const from = buf.readUInt32BE(0);
  const sender = hexlify(buf.slice(4, 36));
  const nonce = buf.readUInt32BE(36);
  const destination = buf.readUInt32BE(40);
  const recipient = hexlify(buf.slice(44, 76));
  const body = hexlify(buf.slice(76));
  return { from, sender, nonce, destination, recipient, body };
}

/**
 * Checks for distinct updates in update logs array. If updates are
 * not equal, this indicates a flaw in our event query logic.
 *
 * @param updates
 * @returns True if valid
 */
function checkDistinctUpdates(updates: AnnotatedUpdate[]): boolean {
  return updates.every((update) => {
    return (
      update.domain === updates[0].domain &&
      update.event.transactionHash === updates[0].event.transactionHash &&
      update.event.logIndex === updates[0].event.logIndex
    );
  });
}

/**
 * A deserialized Nomad message.
 */
export class NomadMessage<T extends NomadContext> {
  readonly dispatch: AnnotatedDispatch;
  readonly message: ParsedMessage;
  readonly home: core.Home;
  readonly replica: core.Replica;

  readonly context: T;
  protected cache: EventCache;

  constructor(context: T, dispatch: AnnotatedDispatch) {
    this.context = context;
    this.message = parseMessage(dispatch.event.args.message);
    this.dispatch = dispatch;
    this.home = context.mustGetCore(this.message.from).home;
    this.replica = context.mustGetReplicaFor(
      this.message.from,
      this.message.destination,
    );
    this.cache = {};
  }

  /**
   * The receipt of the TX that dispatched this message
   */
  get receipt(): TransactionReceipt {
    return this.dispatch.receipt;
  }

  /**
   * Instantiate one or more messages from a receipt.
   *
   * @param context the {@link NomadContext} object to use
   * @param nameOrDomain the domain on which the receipt was logged
   * @param receipt the receipt
   * @returns an array of {@link NomadMessage} objects
   */
  static baseFromReceipt<T extends NomadContext>(
    context: T,
    nameOrDomain: string | number,
    receipt: TransactionReceipt,
  ): NomadMessage<T>[] {
    const messages: NomadMessage<T>[] = [];
    const home = core.Home__factory.createInterface();

    for (const log of receipt.logs) {
      try {
        const parsed = home.parseLog(log);
        if (parsed.name === 'Dispatch') {
          const dispatch = parsed as unknown as DispatchEvent;
          dispatch.getBlock = () => {
            return context
              .mustGetProvider(nameOrDomain)
              .getBlock(log.blockHash);
          };
          dispatch.getTransaction = () => {
            return context
              .mustGetProvider(nameOrDomain)
              .getTransaction(log.transactionHash);
          };
          dispatch.getTransactionReceipt = () => {
            return context
              .mustGetProvider(nameOrDomain)
              .getTransactionReceipt(log.transactionHash);
          };

          const annotated = new Annotated<DispatchTypes, DispatchEvent>(
            context.resolveDomain(nameOrDomain),
            receipt,
            dispatch,
            true,
          );
          annotated.event.blockNumber = annotated.receipt.blockNumber;
          const message = new NomadMessage(context, annotated);
          messages.push(message);
        }
      } catch (e: unknown) {
        if (!e) throw e;
        if (typeof e !== 'object') throw e;

        const err = e as Record<string, unknown>;
        if (!err.code || !err.reason) throw e;

        // Catch known errors that we'd like to squash
        if (
          err.code == Logger.errors.INVALID_ARGUMENT &&
          err.reason == 'no matching event'
        )
          continue;
      }
    }
    return messages;
  }

  /**
   * Instantiate EXACTLY one message from a receipt.
   *
   * @param context the {@link NomadContext} object to use
   * @param nameOrDomain the domain on which the receipt was logged
   * @param receipt the receipt
   * @returns an array of {@link NomadMessage} objects
   * @throws if there is not EXACTLY 1 dispatch in the receipt
   */
  static baseSingleFromReceipt<T extends NomadContext>(
    context: T,
    nameOrDomain: string | number,
    receipt: TransactionReceipt,
  ): NomadMessage<T> {
    const messages: NomadMessage<T>[] = NomadMessage.baseFromReceipt(
      context,
      nameOrDomain,
      receipt,
    );
    if (messages.length !== 1) {
      throw new Error('Expected single Dispatch in transaction');
    }
    return messages[0];
  }

  /**
   * Instantiate one or more messages from a tx hash.
   *
   * @param context the {@link NomadContext} object to use
   * @param nameOrDomain the domain on which the receipt was logged
   * @param receipt the receipt
   * @returns an array of {@link NomadMessage} objects
   * @throws if there is no receipt for the TX
   */
  static async baseFromTransactionHash<T extends NomadContext>(
    context: T,
    nameOrDomain: string | number,
    transactionHash: string,
  ): Promise<NomadMessage<T>[]> {
    const provider = context.mustGetProvider(nameOrDomain);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error(`No receipt for ${transactionHash} on ${nameOrDomain}`);
    }
    return NomadMessage.baseFromReceipt(context, nameOrDomain, receipt);
  }

  /**
   * Instantiate EXACTLY one message from a transaction has.
   *
   * @param context the {@link NomadContext} object to use
   * @param nameOrDomain the domain on which the receipt was logged
   * @param receipt the receipt
   * @returns an array of {@link NomadMessage} objects
   * @throws if there is no receipt for the TX, or if not EXACTLY 1 dispatch in
   *         the receipt
   */
  static async baseSingleFromTransactionHash<T extends NomadContext>(
    context: T,
    nameOrDomain: string | number,
    transactionHash: string,
  ): Promise<NomadMessage<T>> {
    const provider = context.mustGetProvider(nameOrDomain);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error(`No receipt for ${transactionHash} on ${nameOrDomain}`);
    }
    return NomadMessage.baseSingleFromReceipt(context, nameOrDomain, receipt);
  }

  /**
   * Get the Home `Update` event associated with this message (if any)
   *
   * @returns An {@link AnnotatedUpdate} (if any)
   */
  async getHomeUpdate(): Promise<AnnotatedUpdate | undefined> {
    // if we have already gotten the event,
    // return it without re-querying
    if (this.cache.homeUpdate) {
      return this.cache.homeUpdate;
    }

    // if not, attempt to query the event
    const updateFilter = this.home.filters.Update(
      undefined,
      this.committedRoot,
    );

    const updateLogs: AnnotatedUpdate[] = await queryAnnotatedEvents<
      UpdateTypes,
      UpdateArgs
    >(this.context, this.origin, this.home, updateFilter);

    if (updateLogs.length === 1) {
      this.cache.homeUpdate = updateLogs[0];
    } else if (updateLogs.length > 1) {
      // check for distinct (fraudulent) updates
      const validUpdates = checkDistinctUpdates(updateLogs);
      if (validUpdates) {
        // if event is returned and valid, store it to the object
        this.cache.homeUpdate = updateLogs[0];
      } else {
        throw new Error('multiple home updates for same root');
      }
    }
    // return the event or undefined if it doesn't exist
    return this.cache.homeUpdate;
  }

  /**
   * Get the Replica `Update` event associated with this message (if any)
   *
   * @returns An {@link AnnotatedUpdate} (if any)
   */
  async getReplicaUpdate(): Promise<AnnotatedUpdate | undefined> {
    // if we have already gotten the event,
    // return it without re-querying
    if (this.cache.replicaUpdate) {
      return this.cache.replicaUpdate;
    }
    // if not, attempt to query the event
    const updateFilter = this.replica.filters.Update(
      undefined,
      this.committedRoot,
    );
    const updateLogs: AnnotatedUpdate[] = await queryAnnotatedEvents<
      UpdateTypes,
      UpdateArgs
    >(this.context, this.destination, this.replica, updateFilter);

    if (updateLogs.length === 1) {
      this.cache.replicaUpdate = updateLogs[0];
    } else if (updateLogs.length > 1) {
      // check for distinct (fraudulent) updates
      const validUpdates = checkDistinctUpdates(updateLogs);
      if (validUpdates) {
        // if event is returned and valid, store it to the object
        this.cache.replicaUpdate = updateLogs[0];
      } else {
        throw new Error('multiple replica updates for same root');
      }
    }
    // return the event or undefined if it wasn't found
    return this.cache.replicaUpdate;
  }

  /**
   * Get the Replica `Process` event associated with this message (if any)
   *
   * @returns An {@link AnnotatedProcess} (if any)
   */
  async getProcess(): Promise<AnnotatedProcess | undefined> {
    // if we have already gotten the event,
    // return it without re-querying
    if (this.cache.process) {
      return this.cache.process;
    }
    // if not, attempt to query the event
    const processFilter = this.replica.filters.Process(this.leaf);
    const processLogs = await queryAnnotatedEvents<ProcessTypes, ProcessArgs>(
      this.context,
      this.destination,
      this.replica,
      processFilter,
    );
    if (processLogs.length === 1) {
      // if event is returned, store it to the object
      this.cache.process = processLogs[0];
    } else if (processLogs.length > 1) {
      throw new Error('multiple replica process for same message');
    }
    // return the update or undefined if it doesn't exist
    return this.cache.process;
  }

  /**
   * Get all lifecycle events associated with this message
   *
   * @returns An array of {@link AnnotatedLifecycleEvent} objects
   */
  async events(): Promise<NomadStatus> {
    const events: AnnotatedLifecycleEvent[] = [this.dispatch];
    // attempt to get Home update
    const homeUpdate = await this.getHomeUpdate();
    if (!homeUpdate) {
      return {
        status: MessageStatus.Dispatched, // the message has been sent; nothing more
        events,
      };
    }
    events.push(homeUpdate);
    // attempt to get Replica update
    const replicaUpdate = await this.getReplicaUpdate();
    if (!replicaUpdate) {
      return {
        status: MessageStatus.Included, // the message was sent, then included in an Update on Home
        events,
      };
    }
    events.push(replicaUpdate);
    // attempt to get Replica process
    const process = await this.getProcess();
    if (!process) {
      // NOTE: when this is the status, you may way to
      // query confirmAt() to check if challenge period
      // on the Replica has elapsed or not
      return {
        status: MessageStatus.Relayed, // the message was sent, included in an Update, then relayed to the Replica
        events,
      };
    }
    events.push(process);
    return {
      status: MessageStatus.Processed, // the message was processed
      events,
    };
  }

  /**
   * Returns the timestamp after which it is possible to process this message.
   *
   * Note: return the timestamp after which it is possible to process messages
   * within an Update. The timestamp is most relevant during the time AFTER the
   * Update has been Relayed to the Replica and BEFORE the message in question
   * has been Processed.
   *
   * Considerations:
   * - the timestamp will be 0 if the Update has not been relayed to the Replica
   * - after the Update has been relayed to the Replica, the timestamp will be
   *   non-zero forever (even after all messages in the Update have been
   *   processed)
   * - if the timestamp is in the future, the challenge period has not elapsed
   *   yet; messages in the Update cannot be processed yet
   * - if the timestamp is in the past, this does not necessarily mean that all
   *   messages in the Update have been processed
   *
   * @returns The timestamp at which a message can confirm
   */
  async confirmAt(): Promise<BigNumber> {
    const update = await this.getHomeUpdate();
    if (!update) {
      return BigNumber.from(0);
    }
    const { newRoot } = update.event.args;
    return this.replica.confirmAt(newRoot);
  }

  async process(): Promise<ContractTransaction> {
    return this.process()
  }

  /**
   * Retrieve the replica status of this message.
   *
   * @returns The {@link ReplicaMessageStatus} corresponding to the solidity
   * status of the message.
   */
  async replicaStatus(): Promise<ReplicaMessageStatus> {
    return this.replica.messages(this.leaf);
  }

  /**
   * Checks whether the message has been delivered.
   *
   * @returns true if processed, else false.
   */
  async delivered(): Promise<boolean> {
    const status = await this.replicaStatus();
    return status === ReplicaMessageStatus.Processed;
  }

  /**
   * Returns a promise that resolves when the message has been delivered.
   *
   * WARNING: May never resolve. Oftern takes hours to resolve.
   *
   * @param opts Polling options.
   */
  async wait(opts?: { pollTime?: number }): Promise<void> {
    const interval = opts?.pollTime ?? 5000;

    // sad spider face
    for (;;) {
      if (await this.delivered()) {
        return;
      }
      await utils.delay(interval);
    }
  }

  /**
   * The domain from which the message was sent
   */
  get from(): number {
    return this.message.from;
  }

  /**
   * The domain from which the message was sent. Alias for `from`
   */
  get origin(): number {
    return this.from;
  }

  /**
   * The identifier for the sender of this message
   */
  get sender(): string {
    return this.message.sender;
  }

  /**
   * The domain nonce for this message
   */
  get nonce(): number {
    return this.message.nonce;
  }

  /**
   * The destination domain for this message
   */
  get destination(): number {
    return this.message.destination;
  }

  /**
   * The identifer for the recipient for this message
   */
  get recipient(): string {
    return this.message.recipient;
  }

  /**
   * The message body
   */
  get body(): string {
    return this.message.body;
  }

  /**
   * The keccak256 hash of the message body
   */
  get bodyHash(): string {
    return keccak256(this.body);
  }

  /**
   * The hash of the transaction that dispatched this message
   */
  get transactionHash(): string {
    return this.dispatch.event.transactionHash;
  }

  /**
   * The messageHash committed to the tree in the Home contract.
   */
  get leaf(): string {
    return this.dispatch.event.args.messageHash;
  }

  /**
   * The index of the leaf in the contract.
   */
  get leafIndex(): BigNumber {
    return this.dispatch.event.args.leafIndex;
  }

  /**
   * The destination and nonceof this message.
   */
  get destinationAndNonce(): BigNumber {
    return this.dispatch.event.args.destinationAndNonce;
  }

  /**
   * The committed root when this message was dispatched.
   */
  get committedRoot(): string {
    return this.dispatch.event.args.committedRoot;
  }
}
