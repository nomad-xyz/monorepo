import { request, gql } from 'graphql-request';
import { MessageStatus } from './messages/types';

export type IndexerTx = {
  origin?: number;
  destination?: number;
  nonce?: number;
  root?: string;
  messageHash?: string;
  leafIndex?: string;
  sender?: string;
  state?: number;
  dispatchedAt?: number;
  updatedAt?: number;
  relayedAt?: number;
  processedAt?: number;
  receivedAt?: number;
  dispatchTx?: string;
  updateTx?: string;
  relayTx?: string;
  processTx?: string;
  body?: string;
  dispatchBlock?: number;
  internalSender?: string;
  internalRecipient?: string;
  msgType?: number;
  recipient?: string;
  amount?: string;
  allowFast?: boolean;
  detailsHash?: string;
  decimals?: number;
  tokenDomain?: number;
  tokenId?: string;
  confirmAt?: number;
  gasAtDispatch?: string;
  gasAtUpdate?: string;
  gasAtRelay?: string;
  gasAtReceive?: string;
  gasAtProcess?: string;
  sent?: boolean;
  updated?: boolean;
  relayed?: boolean;
  received?: boolean;
  processed?: boolean;
};

function getGqlUrl(environment: string): string {
  let env = '';
  switch (environment) {
    case 'development':
      env = 'dev';
      break;
    case 'production':
      env = 'prod';
      break;
    default:
      env = environment;
  }
  return `https://bridge-indexer.${env}.madlads.tools/graphql`;
}

export async function getEvents(
  env: string,
  dispatchTx: string,
): Promise<IndexerTx> {
  const NOMAD_API = getGqlUrl(env);
  const variables = JSON.stringify({
    where: {
      dispatchTx: {
        equals: dispatchTx,
      },
    },
  });
  const query = gql`
    query MyQuery {
      decoded_dispatch
    }
  `;
  return await request(`${NOMAD_API}`, query, variables).then(async (res) => {
    console.log('result:\n', res.findFirstMessages);
    return res.findFirstMessages;
  });
}

export class Events {
  readonly rpcFallback: boolean;
  protected eventCache: IndexerTx;

  constructor(rpcFallback?: boolean) {
    this.rpcFallback = !!rpcFallback;
    this.eventCache = {};
  }

  /**
   * Get the `Relay` event associated with this message (if any)
   *
   * @returns An relay tx (if any)
   */
  async getRelay(): Promise<string | undefined> {
    if (!this.eventCache.relayed) {
      await this._events();
    }
    return this.eventCache.relayTx;
  }

  /**
   * Get the `Update` event associated with this message (if any)
   *
   * @returns An update tx (if any)
   */
  async getUpdate(): Promise<string | undefined> {
    if (!this.eventCache.updated) {
      await this._events();
    }
    return this.eventCache.updateTx;
  }

  /**
   * Get the Replica `Process` event associated with this message (if any)
   *
   * @returns An process tx (if any)
   */
  async getProcess(): Promise<string | undefined> {
    if (!this.eventCache.processed) {
      await this._events();
    }
    return this.eventCache.processTx;
  }

  /**
   * Get all lifecycle events associated with this message
   *
   * @returns An record of all events and correlating txs
   */
  private async _events(): Promise<IndexerTx> {
    if (this.eventCache.processed) return this.eventCache;
    this.eventCache = await getEvents(
      this.context.conf.environment,
      this.transactionHash,
    );
    return this.eventCache;
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
  async confirmAt(): Promise<number | undefined> {
    if (!this.eventCache.confirmAt || this.eventCache.confirmAt === 0) {
      await this._events();
    }
    if (this.eventCache.confirmAt === 0) return;
    return this.eventCache.confirmAt;
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
    if (this.eventCache.processed) return MessageStatus.Processed;
    const confirmAt = await this.confirmAt();
    const now = Date.now() / 1000;
    if (confirmAt && confirmAt < now) return MessageStatus.Relayed;
    return (await this._events()).state;
  }
}
