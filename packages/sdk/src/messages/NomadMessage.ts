import { ethers, ContractTransaction } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';
import { BigNumber } from '@ethersproject/bignumber';
import { arrayify, hexlify } from '@ethersproject/bytes';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { ErrorCode } from '@ethersproject/logger';
import { Logger } from '@ethersproject/logger';
import * as core from '@nomad-xyz/contracts-core';
import { utils } from '@nomad-xyz/multi-provider';

import { NomadContext } from '..';
import { MessageProof } from '../NomadContext';
import {
  Dispatch,
  ParsedMessage,
  MessageStatus,
  ReplicaStatusNames,
  ReplicaMessageStatus,
} from './types';
import { MessageBackend } from '../messageBackend';

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
 * A deserialized Nomad message.
 */
export class NomadMessage<T extends NomadContext> {
  readonly dispatch: Dispatch;
  readonly message: ParsedMessage;
  readonly home: core.Home;
  readonly replica: core.Replica;

  readonly context: T;
  protected _confirmAt?: Date;

  readonly _backend?: MessageBackend;

  constructor(context: T, dispatch: Dispatch, _backend?: MessageBackend) {
    this.context = context;
    this._backend = _backend;
    this.message = parseMessage(dispatch.args.message);
    this.dispatch = dispatch;
    this.home = context.mustGetCore(this.message.from).home;
    this.replica = context.mustGetReplicaFor(
      this.message.from,
      this.message.destination,
    );
  }

  get backend(): MessageBackend {
    const backend = this._backend || this.context._backend;
    if (!backend) {
      throw new Error(`No backend in the context`);
    }
    return backend;
  }

  get messageHash(): string {
    return this.dispatch.args.messageHash;
  }

  /**
   * Instantiate one or more messages from a receipt.
   *
   * @param context the {@link NomadContext} object to use
   * @param receipt the receipt
   * @returns an array of {@link NomadMessage} objects
   */
  static async baseFromReceipt<T extends NomadContext>(
    context: T,
    receipt: TransactionReceipt,
  ): Promise<NomadMessage<T>[]> {
    const messages: NomadMessage<T>[] = [];
    const home = core.Home__factory.createInterface();

    for (const log of receipt.logs) {
      try {
        const parsed = home.parseLog(log);
        if (parsed.name === 'Dispatch') {
          const {
            messageHash,
            leafIndex,
            destinationAndNonce,
            committedRoot,
            message,
          } = parsed.args;
          const dispatch: Dispatch = {
            args: {
              messageHash,
              leafIndex,
              destinationAndNonce,
              committedRoot,
              message,
            },
            transactionHash: receipt.transactionHash,
          };
          messages.push(new NomadMessage(context, dispatch));
        }
      } catch (e: unknown) {
        console.log('Unexpected error', e);
        const err = e as { code: ErrorCode; reason: string };

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
   * @param receipt the receipt
   * @returns an array of {@link NomadMessage} objects
   * @throws if there is not EXACTLY 1 dispatch in the receipt
   */
  static async baseSingleFromReceipt<T extends NomadContext>(
    context: T,
    receipt: TransactionReceipt,
  ): Promise<NomadMessage<T>> {
    const messages: NomadMessage<T>[] = await NomadMessage.baseFromReceipt(
      context,
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
   * @param transactionHash the transaction hash on the origin chain
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
    return await NomadMessage.baseFromReceipt(context, receipt);
  }

  /**
   * Instantiate EXACTLY one message from a transaction has.
   *
   * @param context the {@link NomadContext} object to use
   * @param nameOrDomain the domain on which the receipt was logged
   * @param transactionHash the transaction hash on the origin chain
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
    return await NomadMessage.baseSingleFromReceipt(context, receipt);
  }

  static async baseFirstFromBackend<T extends NomadContext>(
    context: T,
    transactionHash: string,
  ): Promise<NomadMessage<T>> {
    if (!context._backend) {
      throw new Error(`No backend is set for the context`);
    }
    const dispatches = await context._backend.getDispatches(transactionHash, 1);
    if (!dispatches || dispatches.length === 0) throw new Error(`No dispatch`);

    const m = new NomadMessage(context, dispatches[0]);

    return m;
  }

  static async baseFromMessageHash<T extends NomadContext>(
    context: T,
    messageHash: string,
  ): Promise<NomadMessage<T>> {
    if (!context._backend) {
      throw new Error(`No backend is set for the context`);
    }
    const dispatch = await context._backend.getDispatchByMessageHash(messageHash);
    if (!dispatch) throw new Error(`No dispatch`);

    const m = new NomadMessage(context, dispatch);

    return m;
  }

  /**
   * Get the `Relay` event associated with this message (if any)
   *
   * @returns An relay tx (if any)
   */
  async getRelay(): Promise<string | undefined> {
    return await this.backend.relayTx(this.messageHash);
  }

  /**
   * Get the `Update` event associated with this message (if any)
   *
   * @returns An update tx (if any)
   */
  async getUpdate(): Promise<string | undefined> {
    return await this.backend.updateTx(this.messageHash);
  }

  /**
   * Get the Replica `Process` event associated with this message (if any)
   *
   * @returns An process tx (if any)
   */
  async getProcess(): Promise<string | undefined> {
    return await this.backend.processTx(this.messageHash);
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

  /**
   * Calculates an expected confirmation timestamp from relayed event
   *
   * @returns Timestamp (if any)
   */
  async confirmAt(messageHash: string): Promise<Date | undefined> {
    const relayedAt = await this.backend.relayedAt(messageHash);
    if (relayedAt) {
      // Additional check for adequate numbers
      if (relayedAt?.valueOf() <= 946684800000) {
        throw new Error(
          `RelayedAt could not be smaller than 946684800000 (2000-01-01)`,
        );
      }

      const destinationDomainId = await this.backend.destinationDomainId(
        messageHash,
      );

      // Destination domain must be present as long as relayed at is found already, since
      // destination domain data is present in Dispatch event, and relay data at Relay event,
      // which is later.
      if (!destinationDomainId) {
        throw new Error(`Destination domain is not present`);
      }

      const domain = this.context.getDomain(destinationDomainId);
      if (domain === undefined) {
        throw new Error(`Destination domain is not in the config`);
      }

      const optimisticSecondsUnparsed = domain.configuration.optimisticSeconds;
      const optimisticSeconds: number =
        typeof optimisticSecondsUnparsed === 'string'
          ? parseInt(optimisticSecondsUnparsed)
          : optimisticSecondsUnparsed;

      const confirmAt = new Date(
        relayedAt.valueOf() + optimisticSeconds * 1000,
      );
      return confirmAt;
    }
    return undefined;
  }

  async process(): Promise<ContractTransaction> {
    return this.context.process(this);
  }

  /**
   * Retrieve the replica status of this message.
   *
   * @returns The {@link ReplicaMessageStatus} corresponding to the solidity
   * status of the message.
   */
  async replicaStatus(): Promise<ReplicaMessageStatus> {
    // backwards compatibility. Older replica versions returned a number,
    // newer versions return a hash
    let root: string | number = await this.replica.messages(this.leaf);
    root = root as string | number;

    // case one: root is 0
    if (root === ethers.constants.HashZero || root === 0)
      return { status: ReplicaStatusNames.None };

    // case two: root is 2
    const legacyProcessed = `0x${'00'.repeat(31)}02`;
    if (root === legacyProcessed || root === 2)
      return { status: ReplicaStatusNames.Processed };

    // case 3: root is proven. Could be either the root, or the legacy proven
    // status
    const legacyProven = `0x${'00'.repeat(31)}01`;
    if (typeof root === 'number') root = legacyProven;
    return { status: ReplicaStatusNames.Proven, root: root as string };
  }

  /**
   * Checks whether the message has been delivered.
   *
   * @returns true if processed, else false.
   */
  async delivered(): Promise<boolean> {
    const { status } = await this.replicaStatus();
    return status === ReplicaStatusNames.Processed;
  }

  /**
   * Returns a promise that resolves when the message has been delivered.
   *
   * WARNING: May never resolve. Oftern takes hours to resolve.
   *
   * @param opts Polling options.
   */
  async wait(opts?: { pollTime?: number }): Promise<void> {
    const interval = opts?.pollTime ?? 50;

    // sad spider face
    for (;;) {
      if (await this.delivered()) {
        return;
      }
      await utils.delay(interval);
    }
  }

  /**
   * Get the status of a message
   *
   *    0 = dispatched
   *    1 = included
   *    2 = relayed
   *    3 = updated
   *    4 = received
   *    5 = processed
   *
   * @returns An record of all events and correlating txs
   */
  async status(): Promise<MessageStatus | undefined> {
    if (await this.getProcess()) return MessageStatus.Processed;

    const confirmAt = await this.confirmAt(this.messageHash);
    const now = new Date();
    if (confirmAt && confirmAt < now) return MessageStatus.Relayed;

    if (await this.getUpdate()) return MessageStatus.Included;

    return MessageStatus.Dispatched;
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
   * The name of the domain from which the message was sent
   */
  get originName(): string {
    return this.context.resolveDomainName(this.origin);
  }

  /**
   * Get the name of this file in the s3 bucket
   */
  get s3Name(): string {
    const index = this.leafIndex.toNumber();
    return `${this.originName}_${index}`;
  }

  /**
   * Get the URI for the proof in S3
   */
  get s3Uri(): string | undefined {
    const s3 = this.context.conf.s3;
    if (!s3) throw new Error('s3 data not configured');
    const { bucket, region } = s3;
    const root = `https://${bucket}.s3.${region}.amazonaws.com`;
    return `${root}/${this.s3Name}`;
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
    return this.dispatch.transactionHash;
  }

  /**
   * The messageHash committed to the tree in the Home contract.
   */
  get leaf(): string {
    return this.dispatch.args.messageHash;
  }

  /**
   * The index of the leaf in the contract.
   */
  get leafIndex(): BigNumber {
    return this.dispatch.args.leafIndex;
  }

  /**
   * The destination and nonceof this message.
   */
  get destinationAndNonce(): BigNumber {
    return this.dispatch.args.destinationAndNonce;
  }

  /**
   * The committed root when this message was dispatched.
   */
  get committedRoot(): string {
    return this.dispatch.args.committedRoot;
  }

  /**
   * Get the proof associated with this message
   *
   * @returns a proof, or undefined if no proof available
   * @throws if s3 is not configured for this env
   */
  async getProof(): Promise<MessageProof | undefined> {
    return this.context.fetchProof(this.origin, this.leafIndex.toNumber());
  }
}
