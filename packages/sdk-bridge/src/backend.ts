import { GoldSkyBackend, GoldSkyMessage, MessageFilter, MessageBackend } from '@nomad-xyz/sdk';
import { request, gql } from 'graphql-request';
import * as config from '@nomad-xyz/configuration';
import { BridgeContext } from './BridgeContext';
import { nulls2undefined } from '@nomad-xyz/sdk/src/messageBackend/utils';

const defaultGoldSkySecret = '';

/**
 * Abstract class required for operation of NomadMessage
 */
export default abstract class BridgeMessageBackend extends MessageBackend {
  abstract sender(messageHash: string): Promise<string | undefined>;
  abstract receivedTx(messageHash: string): Promise<string | undefined>;
}

/**
 * GoldSky bridge message representation
 */
export type GoldSkyBridgeMessage = GoldSkyMessage & {
  origin_and_nonce?: string;

  send_tx?: string;
  sent_at?: string;
  send_block?: string;
  original_sender?: string;
  receive_tx?: string;
  receive_block?: string;
  received_at?: string;
};

/**
 * GoldSky bridge backend for NomadMessage
 */
export class GoldSkyBridgeBackend
  extends GoldSkyBackend
  implements BridgeMessageBackend
{
  context: BridgeContext;

  messageCache: Map<string, GoldSkyBridgeMessage>;

  constructor(env: string, secret: string, context: BridgeContext) {
    super(env, secret, context);
    this.messageCache = new Map();
    this.context = context;
  }

  /**
   * Checks whether an environment is supported by the backend. Throws on unsupported
   * @param environment environment to check
   */
  static checkEnvironment(environment: string): void {
    if (environment != 'production') {
      throw new Error(`Only production environment is supported. Provided: ${environment}`);
    }
  }

  /**
   * Creates a default GoldSky backend for an environment
   * @param environment environment to create the backend for
   * @returns backend
   */
  static default(
    environment: string | config.NomadConfig = 'development',
    context: BridgeContext,
  ): GoldSkyBridgeBackend {
    const environmentString =
      typeof environment === 'string' ? environment : environment.environment;

    GoldSkyBridgeBackend.checkEnvironment(environmentString);

    const secret = process.env.GOLDSKY_SECRET || defaultGoldSkySecret;
    if (!secret) throw new Error(`GOLDSKY_SECRET not found in env`);
    return new GoldSkyBridgeBackend(environmentString, secret, context);
  }

  /**
   * Stores message into internal cache
   */
  storeMessage(m: GoldSkyBridgeMessage) {
    this.messageCache.set(m.message_hash, m);
    const messageHashes = this.dispatchTxToMessageHash.get(m.dispatch_tx);
    if (!messageHashes) {
      this.dispatchTxToMessageHash.set(m.dispatch_tx, [m.message_hash]);
    } else {
      if (!messageHashes.includes(m.message_hash))
        messageHashes.push(m.message_hash);
    }
  }

  /**
   * Get the message representation associated with this message (if any)
   * by message hash
   *
   * @returns A message representation (if any)
   */
  async getMessage(
    messageHash: string,
    forceFetch = false,
  ): Promise<GoldSkyBridgeMessage | undefined> {
    let m = this.messageCache.get(messageHash);
    if (!m || forceFetch) {
      m = (
        await this.fetchMessages(
          {
            messageHash,
          },
          1,
        )
      )?.[0];
      if (m) {
        this.storeMessage(m);
      }
    }

    return m;
  }

  /**
   * Get the message representation associated with this message (if any)
   * by dispatch transaction
   *
   * @returns A message representation (if any)
   */
  async getMessagesByTx(
    tx: string,
    limit?: number,
    forceFetch = true,
  ): Promise<GoldSkyBridgeMessage[] | undefined> {
    let ms: GoldSkyBridgeMessage[] | undefined;
    let messageHashes = this.dispatchTxToMessageHash.get(tx);
    const enoughMessages =
      limit && messageHashes && limit <= messageHashes.length;
    if (!enoughMessages || forceFetch) {
      ms = await this.fetchMessages({
        transactionHash: tx,
      });
      if (ms && ms.length) {
        ms.forEach((m) => this.storeMessage(m));
      }
    } else {
      // messageHashes! are there as they are already tested in `enoughHashes` above
      // getMessage(hash)! is also there as in order to get into `messageHashes` a message needs to get fetched
      ms = await Promise.all(
        messageHashes!.map(async (hash) => {
          return (await this.getMessage(hash))!;
        }),
      );
    }

    return ms;
  }

  /**
   * Gets an original sender of the message
   * @param messageHash
   * @returns sender's address
   */
  async sender(messageHash: string): Promise<string | undefined> {
    let m = await this.getMessage(messageHash);
    if (!m?.original_sender) m = await this.getMessage(messageHash, true);
    return m?.original_sender;
  }

  /**
   * Gets a transaction related to Received event
   * @param messageHash
   * @returns transaction hash
   */
  async receivedTx(messageHash: string): Promise<string | undefined> {
    let m = await this.getMessage(messageHash);
    if (!m?.receive_tx) m = await this.getMessage(messageHash, true);
    return m?.receive_tx;
  }

  /**
   * Fetches internal message from backend
   *
   * @returns Internal message representation (if any)
   */
  async fetchMessages(
    f: Partial<MessageFilter>,
    limit?: number,
  ): Promise<GoldSkyBridgeMessage[] | undefined> {
    const query = gql`
      query Query(
        $committedRoot: String
        $messageHash: String
        $transactionHash: String
        $limit: Int
      ) {
        bridge_events(
          where: {
            _or: [
              { dispatch_tx: { _eq: $transactionHash } }
              { message_hash: { _eq: $messageHash } }
              { old_root: { _eq: $committedRoot } }
            ]
          }
          limit: $limit
        ) {
          committed_root
          destination_and_nonce
          destination_domain_id
          destination_domain_name
          dispatch_block
          dispatch_tx
          dispatched_at
          id
          leaf_index
          message
          message__action__amount
          message__action__details_hash
          message__action__to
          message__action__type
          message__token__domain
          message__token__id
          message_body
          message_hash
          message_type
          new_root
          nonce
          old_root
          origin_domain_id
          origin_domain_name
          process_block
          process_tx
          processed_at
          recipient_address
          relay_block
          relay_chain_id
          relay_tx
          relayed_at
          sender_address
          signature
          update_block
          update_chain_id
          update_tx
          updated_at

          send_tx
          sent_at
          send_block
          original_sender

          receive_tx
          origin_and_nonce
          receive_block
          received_at
        }
      }
    `;

    const headers = {
      'content-type': 'application/json',
      'x-hasura-admin-secret': this._secret,
    };

    const filter = {
      ...GoldSkyBackend.fillFilter(f),
      limit: limit || null,
    };

    const response = await request(this.uri, query, filter, headers);

    const events: GoldSkyBridgeMessage[] = nulls2undefined(response.events);

    if (!events || events.length <= 0) return undefined;

    return events;
  }
}
