import {
  Dispatch,
  CoreContracts,
  NomadContext,
  NomadMessage,
} from '@nomad-xyz/sdk';
import { ethers } from 'ethers';

const ACTION_LEN = {
  identifier: 1,
  batch: 33,
  transferGovernor: 37,
};

enum ActionTypes {
  batch = 1,
  transferGovernor = 2,
}

enum BatchStatus {
  Unknown = 0,
  Pending,
  Complete,
}

type Batch = {
  type: 'batch';
  batchHash: string;
};

type TransferGovernor = {
  type: 'transferGovernor';
  domain: number;
  address: string;
};

export type Action = Batch | TransferGovernor;

export function parseAction(raw: ethers.BytesLike): Action {
  const buf = ethers.utils.arrayify(raw);
  const actionType = buf[0];
  if (buf.length === ACTION_LEN.batch && actionType === ActionTypes.batch) {
    return {
      type: 'batch',
      batchHash: ethers.utils.hexlify(buf.slice(1, 33)),
    };
  } else if (
    buf.length === ACTION_LEN.transferGovernor &&
    actionType === ActionTypes.transferGovernor
  ) {
    return {
      type: 'transferGovernor',
      domain: Buffer.from(buf).readUInt32BE(1),
      address: ethers.utils.hexlify(buf.slice(5, 37)),
    };
  }
  throw new Error('Bad message');
}

export type AnyGovernanceMessage = TransferGovernorMessage | BatchMessage;

/**
 * The GovernanceMessage extends {@link nomadMessage} with Governance-specific
 * functionality.
 */
class GovernanceMessage extends NomadMessage<NomadContext> {
  readonly fromCore: CoreContracts<NomadContext>;
  readonly toCore: CoreContracts<NomadContext>;

  /**
   * @hideconstructor
   */
  constructor(
    context: NomadContext,
    dispatch: Dispatch,
    callerKnowsWhatTheyAreDoing: boolean,
  ) {
    if (!callerKnowsWhatTheyAreDoing) {
      throw new Error('Use `fromReceipt` to instantiate');
    }
    super(context, dispatch);

    this.fromCore = context.mustGetCore(this.message.from);
    this.toCore = context.mustGetCore(this.message.destination);
  }

  /**
   * Attempt to instantiate a Governance from an existing
   * {@link nomadMessage}
   *
   * @param context The {@link NomadContext} to use.
   * @param nomadMessage The existing nomadMessage
   * @returns A Governance message
   * @throws if the message cannot be parsed as a governance message
   */
  static fromNomadMessage<T extends NomadContext>(
    context: NomadContext,
    nomadMessage: NomadMessage<T>,
  ): AnyGovernanceMessage {
    const parsed = parseAction(nomadMessage.message.body);
    switch (parsed.type) {
      case 'batch':
        return new BatchMessage(context, nomadMessage.dispatch, parsed);
      case 'transferGovernor':
        return new TransferGovernorMessage(
          context,
          nomadMessage.dispatch,
          parsed,
        );
    }
  }

  /**
   * Attempt to instantiate some GovernanceMessages from a transaction receipt
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param receipt The receipt
   * @returns an array of {@link GovernanceMessage} objects
   */
  static fromReceipt(
    context: NomadContext,
    nameOrDomain: string | number,
    receipt: ethers.providers.TransactionReceipt,
  ): AnyGovernanceMessage[] {
    const nomadMessages: NomadMessage<NomadContext>[] =
      NomadMessage.baseFromReceipt(context, nameOrDomain, receipt);
    const governanceMessages: AnyGovernanceMessage[] = [];
    for (const nomadMessage of nomadMessages) {
      try {
        const governanceMessage = GovernanceMessage.fromNomadMessage(
          context,
          nomadMessage,
        );
        governanceMessages.push(governanceMessage);
      } catch (e) {
        // catch error if nomadMessage isn't a GovernanceMessage
      }
    }
    return governanceMessages;
  }

  /**
   * Attempt to instantiate EXACTLY one GovernanceMessage from a transaction receipt
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param receipt The receipt
   * @returns an array of {@link GovernanceMessage} objects
   * @throws if there is not EXACTLY 1 GovernanceMessage in the receipt
   */
  static singleFromReceipt(
    context: NomadContext,
    nameOrDomain: string | number,
    receipt: ethers.providers.TransactionReceipt,
  ): AnyGovernanceMessage {
    const messages = GovernanceMessage.fromReceipt(
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
   * Attempt to instantiate some GovernanceMessages from a transaction hash by
   * retrieving and parsing the receipt.
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param transactionHash The transaction hash
   * @returns an array of {@link GovernanceMessage} objects
   * @throws if there is no receipt for the transaction hash on the domain
   */
  static async fromTransactionHash(
    context: NomadContext,
    nameOrDomain: string | number,
    transactionHash: string,
  ): Promise<AnyGovernanceMessage[]> {
    const provider = context.mustGetProvider(nameOrDomain);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error(`No receipt for ${transactionHash} on ${nameOrDomain}`);
    }
    return GovernanceMessage.fromReceipt(context, nameOrDomain, receipt);
  }

  /**
   * Attempt to instantiate EXACTLY one GovernanceMessages from a transaction hash
   * by retrieving and parsing the receipt.
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param transactionHash The transaction hash
   * @returns an array of {@link GovernanceMessage} objects
   * @throws if there is no receipt for the transaction hash on the domain or if
   * if there is no EXACTLY one parsable governance message in that
   * transaction
   */
  static async singleFromTransactionHash(
    context: NomadContext,
    nameOrDomain: string | number,
    transactionHash: string,
  ): Promise<AnyGovernanceMessage> {
    const provider = context.mustGetProvider(nameOrDomain);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error(`No receipt for ${transactionHash} on ${nameOrDomain}`);
    }
    return GovernanceMessage.singleFromReceipt(context, nameOrDomain, receipt);
  }
}

/**
 * A BatchMessage extends the {@link GovernanceMessage} with batch-specific
 * functionality.
 */
export class BatchMessage extends GovernanceMessage {
  readonly action: Batch;

  constructor(context: NomadContext, dispatch: Dispatch, parsed: Batch) {
    super(context, dispatch, true);
    this.action = parsed;
  }

  /**
   * The batch hash to be executed
   */
  get batchHash(): string {
    return this.action.batchHash;
  }

  /**
   * Query the recipient governance router for the batch status
   * @returns The status of the batch
   */
  async status(): Promise<BatchStatus> {
    const core = this.context.mustGetCore(this.destination);
    const status = await core.governanceRouter.inboundCallBatches(
      this.batchHash,
    );
    return status;
  }

  /**
   * Query the recipient domain to see if the batch is complete
   */
  async isExecuted(): Promise<boolean> {
    return (await this.status()) === BatchStatus.Complete;
  }

  /**
   * Query the recipient domain to see if the batch is pending
   */
  async isPending(): Promise<boolean> {
    return (await this.status()) === BatchStatus.Pending;
  }
}

/**
 * A TransferGovernorMessage extends the {@link GovernanceMessage} with
 * governance-transfer-specific functionality.
 */
export class TransferGovernorMessage extends GovernanceMessage {
  readonly action: TransferGovernor;

  constructor(
    context: NomadContext,
    dispatch: Dispatch,
    parsed: TransferGovernor,
  ) {
    super(context, dispatch, true);
    this.action = parsed;
  }

  /**
   * Details of the new governor
   */
  get newGovernor(): TransferGovernor {
    return this.action;
  }
}
