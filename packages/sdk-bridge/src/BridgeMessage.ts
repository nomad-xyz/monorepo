import { BigNumber } from '@ethersproject/bignumber';
import { arrayify, hexlify } from '@ethersproject/bytes';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { ethers } from 'ethers';
import * as bridge from '@nomad-xyz/contracts-bridge';
import { NomadMessage, Dispatch } from '@nomad-xyz/sdk';
import { ResolvedTokenInfo, TokenIdentifier } from './tokens';
import { BridgeContracts } from './BridgeContracts';
import { BridgeContext } from './BridgeContext';
import BridgeMessageBackend, { GoldSkyBridgeBackend } from './backend';

const ACTION_LEN = {
  identifier: 1,
  tokenId: 36,
  transfer: 97,
};

type Transfer = {
  type: 'transfer';
  to: string;
  amount: BigNumber;
  detailsHash: string;
  allowFast: boolean;
};

export type Action = Transfer;

export type ParsedBridgeMessage<T extends Action> = {
  token: TokenIdentifier;
  action: T;
};

export type AnyBridgeMessage = TransferMessage;
export type ParsedTransferMessage = ParsedBridgeMessage<Transfer>;

function parseAction(buf: Uint8Array): Action {
  // Transfer
  if (buf.length === ACTION_LEN.transfer) {
    // trim identifer
    const actionType = buf[0];
    buf = buf.slice(ACTION_LEN.identifier);
    return {
      type: 'transfer',
      to: hexlify(buf.slice(0, 32)),
      amount: BigNumber.from(hexlify(buf.slice(32, 64))),
      detailsHash: hexlify(buf.slice(64)),
      allowFast: actionType === 4,
    };
  }

  throw new Error('Bad action');
}

export function parseBody(messageBody: string): ParsedTransferMessage {
  const buf = arrayify(messageBody);

  const tokenId = buf.slice(0, 36);
  const token = {
    domain: Buffer.from(tokenId).readUInt32BE(0),
    id: hexlify(tokenId.slice(4, 36)),
  };

  const action = parseAction(buf.slice(36));
  const parsedMessage = {
    action,
    token,
  };

  return parsedMessage;
}

/**
 * The BridgeMessage extends {@link nomadMessage} with Bridge-specific
 * functionality.
 */
export class BridgeMessage extends NomadMessage<BridgeContext> {
  readonly token: TokenIdentifier;
  readonly fromBridge: BridgeContracts;
  readonly toBridge: BridgeContracts;

  readonly _backend?: BridgeMessageBackend;


  /**
   * @hideconstructor
   */
  constructor(
    context: BridgeContext,
    dispatch: Dispatch,
    token: TokenIdentifier,
    callerKnowsWhatTheyAreDoing: boolean,
    _backend?: BridgeMessageBackend,
  ) {
    if (!callerKnowsWhatTheyAreDoing) {
      throw new Error('Use `fromReceipt` to instantiate');
    }
    super(context, dispatch, _backend);

    const fromBridge = context.mustGetBridge(this.message.from);
    const toBridge = context.mustGetBridge(this.message.destination);

    this.fromBridge = fromBridge;
    this.toBridge = toBridge;
    this.token = token;
  }

  get backend(): BridgeMessageBackend {
    const backend = this._backend || this.context._backend;
    if (!backend) {
      throw new Error(`No backend in the context`);
    }
    return backend;
  }

  async getReceived(): Promise<string | undefined> {
    return await this.backend.receivedTx(this.messageHash);
  }

  async getSender(): Promise<string | undefined> {
    return await this.backend.sender(this.messageHash);
  }

  static async bridgeBaseFromTransactionHashUsingBackend(
    context: BridgeContext,
    transactionHash: string,
    _backend?: BridgeMessageBackend,
  ): Promise<BridgeMessage> {
    const backend = context._backend || _backend;
    if (!backend) {
      throw new Error(`No backend is set for the context`);
    }
    const dispatch = await backend.getDispatch(transactionHash);
    if (!dispatch) throw new Error(`No dispatch`);

    const m = new NomadMessage(context, dispatch);
    const bm = BridgeMessage.fromNomadMessage(context, m, _backend);

    return bm;
  }

  /**
   * Attempt to instantiate a BridgeMessage from an existing
   * {@link nomadMessage}
   *
   * @param context The {@link NomadContext} to use.
   * @param nomadMessage The existing nomadMessage
   * @returns A Bridge message
   * @throws if the message cannot be parsed as a bridge message
   */
  static fromNomadMessage(
    context: BridgeContext,
    nomadMessage: NomadMessage<BridgeContext>,
    _backend?: BridgeMessageBackend,
  ): AnyBridgeMessage {
    const parsedMessageBody = parseBody(nomadMessage.message.body);
    return new TransferMessage(
      context,
      nomadMessage.dispatch,
      parsedMessageBody as ParsedTransferMessage,
      _backend || context._backend || GoldSkyBridgeBackend.default(context.environment) // TODO: adjust
    );
  }

  /**
   * Attempt to instantiate some BridgeMessages from a transaction receipt
   *
   * @param context The {@link NomadContext} to use.
   * @param receipt The receipt
   * @returns an array of {@link BridgeMessage} objects
   * @throws if any message cannot be parsed as a bridge message
   */
  static async fromReceipt(
    context: BridgeContext,
    receipt: TransactionReceipt,
    _backend?: BridgeMessageBackend,
  ): Promise<AnyBridgeMessage[]> {
    const nomadMessages: NomadMessage<BridgeContext>[] =
      await NomadMessage.baseFromReceipt(context, receipt);
    const bridgeMessages: AnyBridgeMessage[] = [];
    for (const nomadMessage of nomadMessages) {
      try {
        const bridgeMessage = BridgeMessage.fromNomadMessage(
          context,
          nomadMessage,
          _backend,
        );
        bridgeMessages.push(bridgeMessage);
      } catch (e) {
        // catch error if nomadMessage isn't a BridgeMessage
      }
    }
    return bridgeMessages;
  }

  /**
   * Attempt to instantiate EXACTLY one BridgeMessage from a transaction receipt
   *
   * @param context The {@link BridgeContext} to use.
   * @param receipt The receipt
   * @returns an array of {@link BridgeMessage} objects
   * @throws if any message cannot be parsed as a bridge message, or if there
   *         is not EXACTLY 1 BridgeMessage in the receipt
   */
  static async singleFromReceipt(
    context: BridgeContext,
    receipt: TransactionReceipt,
    _backend?: BridgeMessageBackend,
    ): Promise<AnyBridgeMessage> {
    const messages: AnyBridgeMessage[] = await BridgeMessage.fromReceipt(
      context,
      receipt,
      _backend,
    );
    if (messages.length !== 1) {
      throw new Error('Expected single Dispatch in transaction');
    }
    return messages[0];
  }

  /**
   * Attempt to instantiate some BridgeMessages from a transaction hash by
   * retrieving and parsing the receipt.
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param transactionHash the transaction hash on the origin chain
   * @returns an array of {@link BridgeMessage} objects
   * @throws if any message cannot be parsed as a bridge message
   */
  static async fromTransactionHash(
    context: BridgeContext,
    nameOrDomain: string | number,
    transactionHash: string,
    _backend?: BridgeMessageBackend,
    ): Promise<AnyBridgeMessage[]> {
    const provider = context.mustGetProvider(nameOrDomain);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error(`No receipt for ${transactionHash} on ${nameOrDomain}`);
    }
    return BridgeMessage.fromReceipt(context, receipt, _backend);
  }

  /**
   * Attempt to instantiate EXACTLY one BridgeMessages from a transaction hash
   * by retrieving and parsing the receipt.
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param transactionHash the transaction hash on the origin chain
   * @returns an array of {@link BridgeMessage} objects
   * @throws if any message cannot be parsed as a bridge message, or if there is
   *         not EXACTLY one such message
   */
  static async singleFromTransactionHash(
    context: BridgeContext,
    nameOrDomain: string | number,
    transactionHash: string,
    _backend?: BridgeMessageBackend,
    ): Promise<AnyBridgeMessage> {
    const provider = context.mustGetProvider(nameOrDomain);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error(`No receipt for ${transactionHash} on ${nameOrDomain}`);
    }
    return BridgeMessage.singleFromReceipt(context, receipt, _backend);
  }

  /**
   * Resolves the asset that is being transfered
   *
   * WARNING: do not hold references to these contract, as they will not be
   * reconnected in the event the chain connection changes.
   *
   * @returns The resolved token information.
   */
  async asset(): Promise<ResolvedTokenInfo> {
    return await this.context.resolveRepresentations(this.token);
  }

  /**
   * Resolves an interface for the asset that is being transfered on the chain
   * FROM WHICH it is being transferred
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @returns The resolved token interface.
   */
  async assetAtOrigin(): Promise<bridge.BridgeToken | undefined> {
    return (await this.asset()).tokens.get(this.origin);
  }

  /**
   * Resolves an interface for the asset that is being transfered on the chain
   * TO WHICH it is being transferred
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @returns The resolved token interface.
   */
  async assetAtDestination(): Promise<bridge.BridgeToken | undefined> {
    return (await this.asset()).tokens.get(this.destination);
  }
}

/**
 * A TransferMessage extends the {@link BridgeMessage} with transfer-specific
 * functionality.
 */
export class TransferMessage extends BridgeMessage {
  action: Transfer;

  constructor(
    context: BridgeContext,
    dispatch: Dispatch,
    parsed: ParsedTransferMessage,
    _backend?: BridgeMessageBackend, 
  ) {
    super(context, dispatch, parsed.token, true, _backend);
    this.action = parsed.action;
  }

  /**
   * Check if the transfer has been prefilled using the fast liquidity system.
   *
   * @returns true if the transfer has been prefilled. Else false.
   */
  async currentlyPrefilled(): Promise<boolean> {
    const bridge = this.context.mustGetBridge(this.destination);
    const lpAddress = await bridge.bridgeRouter.liquidityProvider(
      this.prefillId,
    );
    if (lpAddress !== ethers.constants.AddressZero) {
      return true;
    }
    return false;
  }

  /**
   * The amount of tokens being transferred (in the smallest unit)
   */
  get amount(): BigNumber {
    return this.action.amount;
  }

  /**
   * The identifier for the recipient of the tokens
   */
  get to(): string {
    return this.action.to;
  }

  /**
   * The ID used for prefilling this transfer message.
   */
  get prefillId(): string {
    return this.bodyHash;
  }
}
