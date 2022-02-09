import { BigNumber } from '@ethersproject/bignumber';
import { arrayify, hexlify } from '@ethersproject/bytes';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { ethers } from 'ethers';
import * as bridge from '@nomad-xyz/bridge-contracts';
import { NomadMessage, AnnotatedDispatch } from '@nomad-xyz/sdk';
import { ResolvedTokenInfo, TokenIdentifier } from './tokens';
import { BridgeContracts } from './BridgeContracts';
import { BridgeContext } from './BridgeContext';

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

function parseBody(messageBody: string): ParsedTransferMessage {
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
class BridgeMessage extends NomadMessage<BridgeContext> {
  readonly token: TokenIdentifier;
  readonly fromBridge: BridgeContracts;
  readonly toBridge: BridgeContracts;

  /**
   * @hideconstructor
   */
  constructor(
    context: BridgeContext,
    event: AnnotatedDispatch,
    token: TokenIdentifier,
    callerKnowsWhatTheyAreDoing: boolean,
  ) {
    if (!callerKnowsWhatTheyAreDoing) {
      throw new Error('Use `fromReceipt` to instantiate');
    }
    super(context, event);

    const fromBridge = context.mustGetBridge(this.message.from);
    const toBridge = context.mustGetBridge(this.message.destination);

    this.fromBridge = fromBridge;
    this.toBridge = toBridge;
    this.token = token;
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
  ): AnyBridgeMessage {
    const parsedMessageBody = parseBody(nomadMessage.message.body);
    return new TransferMessage(
      context,
      nomadMessage.dispatch,
      parsedMessageBody as ParsedTransferMessage,
    );
  }

  /**
   * Attempt to instantiate some BridgeMessages from a transaction receipt
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param receipt The receipt
   * @returns an array of {@link BridgeMessage} objects
   * @throws if any message cannot be parsed as a bridge message
   */
  static fromReceipt(
    context: BridgeContext,
    nameOrDomain: string | number,
    receipt: TransactionReceipt,
  ): AnyBridgeMessage[] {
    const nomadMessages: NomadMessage<BridgeContext>[] =
      NomadMessage.baseFromReceipt(context, nameOrDomain, receipt);
    const bridgeMessages: AnyBridgeMessage[] = [];
    for (const nomadMessage of nomadMessages) {
      try {
        const bridgeMessage = BridgeMessage.fromNomadMessage(
          context,
          nomadMessage,
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
   * @param nameOrDomain the domain on which the receipt was logged
   * @param receipt The receipt
   * @returns an array of {@link BridgeMessage} objects
   * @throws if any message cannot be parsed as a bridge message, or if there
   *         is not EXACTLY 1 BridgeMessage in the receipt
   */
  static singleFromReceipt(
    context: BridgeContext,
    nameOrDomain: string | number,
    receipt: TransactionReceipt,
  ): AnyBridgeMessage {
    const messages: AnyBridgeMessage[] = BridgeMessage.fromReceipt(
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
   * Attempt to instantiate some BridgeMessages from a transaction hash by
   * retrieving and parsing the receipt.
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param transactionHash The transaction hash
   * @returns an array of {@link BridgeMessage} objects
   * @throws if any message cannot be parsed as a bridge message
   */
  static async fromTransactionHash(
    context: BridgeContext,
    nameOrDomain: string | number,
    transactionHash: string,
  ): Promise<AnyBridgeMessage[]> {
    const provider = context.mustGetProvider(nameOrDomain);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error(`No receipt for ${transactionHash} on ${nameOrDomain}`);
    }
    return BridgeMessage.fromReceipt(context, nameOrDomain, receipt);
  }

  /**
   * Attempt to instantiate EXACTLY one BridgeMessages from a transaction hash
   * by retrieving and parsing the receipt.
   *
   * @param context The {@link NomadContext} to use.
   * @param nameOrDomain the domain on which the receipt was logged
   * @param transactionHash The transaction hash
   * @returns an array of {@link BridgeMessage} objects
   * @throws if any message cannot be parsed as a bridge message, or if there is
   *         not EXACTLY one such message
   */
  static async singleFromTransactionHash(
    context: BridgeContext,
    nameOrDomain: string | number,
    transactionHash: string,
  ): Promise<AnyBridgeMessage> {
    const provider = context.mustGetProvider(nameOrDomain);
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      throw new Error(`No receipt for ${transactionHash} on ${nameOrDomain}`);
    }
    return BridgeMessage.singleFromReceipt(context, nameOrDomain, receipt);
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
  async assetAtOrigin(): Promise<bridge.ERC20 | undefined> {
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
  async assetAtDestination(): Promise<bridge.ERC20 | undefined> {
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
    event: AnnotatedDispatch,
    parsed: ParsedTransferMessage,
  ) {
    super(context, event, parsed.token, true);
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
