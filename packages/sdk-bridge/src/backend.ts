import {  GoldSkyBackend, GoldSkyMessage, MessageFilter } from "@nomad-xyz/sdk";
import {MessageBackend} from "@nomad-xyz/sdk";
import { request, gql } from 'graphql-request';
import * as config from '@nomad-xyz/configuration';

const defaultGoldSkySecret = "";


/**
 * Abstract class required for operation of NomadMessage
 */
 export default abstract class BridgeMessageBackend extends MessageBackend {
    abstract sender(messageHash: string): Promise<string | undefined>;
    abstract receivedTx(messageHash: string): Promise<string | undefined>;
}


export type GoldSkyBridgeMessage =  GoldSkyMessage & {
    send_tx: string,
    sent_at: string,
    send_block: string,
    original_sender: string,
    receive_tx: string,
    origin_and_nonce: string,
    receive_block: string,
    received_at: string,
};

/**
 * GoldSky bridge backend for NomadMessage 
 */
export class GoldSkyBridgeBackend extends GoldSkyBackend implements BridgeMessageBackend {

    messageCache: Map<string, GoldSkyBridgeMessage>;

    constructor(env: string, secret: string) {
        super(env, secret);
        this.messageCache = new Map();
    }

    /**
     * Checks whether an environment is supported by the backend. Throws on unsupported
     * @param environment environment to check
     */
    static checkEnvironment(environment: string): void {
        if (environment != 'production') {
            throw new Error(`Only production environment is supported`);
        }
    }

    /**
     * Creates a default GoldSky backend for an environment
     * @param environment environment to create the backend for
     * @returns backend
     */
    static default(environment: string | config.NomadConfig = 'development'): GoldSkyBridgeBackend {
        const environmentString = typeof environment === 'string' ? environment : environment.environment;

        GoldSkyBridgeBackend.checkEnvironment(environmentString);
        
        const secret = process.env.GOLDSKY_SECRET || defaultGoldSkySecret;
        if (!secret) throw new Error(`GOLDSKY_SECRET not found in env`);
        return new GoldSkyBridgeBackend(environmentString, secret);
    }

    /**
     * Stores message into internal cache
     */
    storeMessage(m: GoldSkyBridgeMessage): void {
        this.messageCache.set(m.message_hash, m);
        this.dispatchTxToMessageHash.set(m.dispatch_tx, m.message_hash);
    }

    /**
     * Get the message representation associated with this message (if any)
     * by message hash
     *
     * @returns A message representation (if any)
     */
    async getMessage(messageHash: string): Promise<GoldSkyBridgeMessage | undefined> {
        let m = this.messageCache.get(messageHash);
        if (!m) {
            m = await this.fetchMessage({
                messageHash,
            });
            if (m) {
                this.storeMessage(m);
            }
        }

        return m;
    }

    /**
     * Gets an original sender of the message
     * @param messageHash 
     * @returns sender's address
     */
    async sender(messageHash: string): Promise<string | undefined> {
        const m = await this.getMessage(messageHash);
        return m?.original_sender;
    }

    /**
     * Gets a transaction related to Received event
     * @param messageHash 
     * @returns transaction hash
     */
    async receivedTx(messageHash: string): Promise<string | undefined> {
        const m = await this.getMessage(messageHash);
        return m?.receive_tx;
    }

    /**
     * Fetches internal message from backend
     *
     * @returns Internal message representation (if any)
     */
     async fetchMessage(f: Partial<MessageFilter>): Promise<GoldSkyBridgeMessage|undefined> {

        const query = gql`
          query Query($committedRoot: String, $messageHash: String, $transactionHash: String) {

                  bridge_events(where: {_or: [{dispatch_tx: {_eq: $transactionHash}}, {message_hash: {_eq: $messageHash}}, {old_root: {_eq: $committedRoot}}]}) {
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
          "content-type": "application/json",
          "x-hasura-admin-secret": this._secret,
        };

      const response = await request(this.uri, query, GoldSkyBackend.fillFilter(f), headers);

      const events = response.bridge_events;

      if (events.length <= 0) return undefined;
      else if (events.length > 5) throw new Error(`Transaction contains more than one Dispatch event`);

      const r: GoldSkyBridgeMessage = {
          committed_root: events[0].committed_root,
          destination_and_nonce: events[0].destination_and_nonce,
          destination_domain_id: events[0].destination_domain_id,
          destination_domain_name: events[0].destination_domain_name,
          dispatch_block: events[0].dispatch_block,
          dispatch_tx: events[0].dispatch_tx,
          dispatched_at: events[0].dispatched_at,
          id: events[0].id,
          leaf_index: events[0].leaf_index,
          message: events[0].message,
          message__action__amount: events[0].message__action__amount,
          message__action__details_hash: events[0].message__action__details_hash,
          message__action__to: events[0].message__action__to,
          message__action__type: events[0].message__action__type,
          message__token__domain: events[0].message__token__domain,
          message__token__id: events[0].message__token__id,
          message_body: events[0].message_body,
          message_hash: events[0].message_hash,
          message_type: events[0].message_type,
          new_root: events[0].new_root,
          nonce: events[0].nonce,
          old_root: events[0].old_root,
          origin_domain_id: events[0].origin_domain_id,
          origin_domain_name: events[0].origin_domain_name,
          process_block: events[0].process_block,
          process_tx: events[0].process_tx,
          processed_at: events[0].processed_at,
          recipient_address: events[0].recipient_address,
          relay_block: events[0].relay_block,
          relay_chain_id: events[0].relay_chain_id,
          relay_tx: events[0].relay_tx,
          relayed_at: events[0].relayed_at,
          sender_address: events[0].sender_address,
          signature: events[0].signature,
          update_block: events[0].update_block,
          update_chain_id: events[0].update_chain_id,
          update_tx: events[0].update_tx,
          updated_at: events[0].updated_at,

          send_tx: events[0].send_tx,
          sent_at: events[0].sent_at,
          send_block: events[0].send_block,
          original_sender: events[0].original_sender,
          receive_tx: events[0].receive_tx,
          origin_and_nonce: events[0].origin_and_nonce,
          receive_block: events[0].receive_block,
          received_at: events[0].received_at,
      };


      return r;
  }
}