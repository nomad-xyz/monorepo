import {  GoldSkyBackend, GoldSkyMessage, MessageFilter } from "@nomad-xyz/sdk";
import {MessageBackend} from "@nomad-xyz/sdk";
import { request, gql } from 'graphql-request';
// import { Dispatch } from '../messages';
import * as config from '@nomad-xyz/configuration';

const defaultGoldSkySecret = "";


/**
 * Abstract class required for operation of NomadMessage
 */
 export default abstract class BridgeMessageBackend extends MessageBackend {
    // abstract getDispatch(tx: string): Promise<Dispatch | undefined>;
    // abstract getMessageHash(tx: string): Promise<string | undefined>;
    abstract sender(messageHash: string): Promise<string | undefined>;
    abstract receivedTx(messageHash: string): Promise<string | undefined>;
    // abstract relayTx(messageHash: string): Promise<string | undefined>;
    // abstract processTx(messageHash: string): Promise<string | undefined>;
    // abstract confirmAt(messageHash: string): Promise<Date | undefined>;
}


export type GoldSkyBridgeMessage =  GoldSkyMessage & {
    send_tx: string,
    sent_at: string,
    send_block: string,
    receive_tx: string,
    origin_and_nonce: string,
    receive_block: string,
    received_at: string,
};


export class GoldSkyBridgeBackend extends GoldSkyBackend implements BridgeMessageBackend {

    messageCache: Map<string, GoldSkyBridgeMessage>;

    constructor(env: string, secret: string) {
        super(env, secret);
        this.messageCache = new Map();
    }

    static checkEnvironment(environment: string) {
        if (environment != 'production') {
            throw new Error(`Only production environment is supported`);
        }
    }

    static default(environment: string | config.NomadConfig = 'development'): GoldSkyBridgeBackend {
        const environmentString = typeof environment === 'string' ? environment : environment.environment;

        GoldSkyBridgeBackend.checkEnvironment(environmentString);
        
        const secret = process.env.GOLDSKY_SECRET || defaultGoldSkySecret;
        if (!secret) throw new Error(`GOLDSKY_SECRET not found in env`);
        return new GoldSkyBridgeBackend(environmentString, secret);
    }

    async sender(messageHash: string): Promise<string | undefined> {
        return 'sender not implemented in SQL view yet';
    }
    async receivedTx(messageHash: string): Promise<string | undefined> {
        const m = await this.getMessage(messageHash);
        return m?.relay_tx;
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
        }

      const response = await request(this.uri, query, GoldSkyBackend.fillFilter(f), headers);

      if (response.events.length <= 0) return undefined;
      else if (response.events.length > 1) throw new Error(`Transaction contains more than one Dispatch event`);

      const r: GoldSkyBridgeMessage = {
          committed_root: response.events[0].committed_root,
          destination_and_nonce: response.events[0].destination_and_nonce,
          destination_domain_id: response.events[0].destination_domain_id,
          destination_domain_name: response.events[0].destination_domain_name,
          dispatch_block: response.events[0].dispatch_block,
          dispatch_tx: response.events[0].dispatch_tx,
          dispatched_at: response.events[0].dispatched_at,
          id: response.events[0].id,
          leaf_index: response.events[0].leaf_index,
          message: response.events[0].message,
          message__action__amount: response.events[0].message__action__amount,
          message__action__details_hash: response.events[0].message__action__details_hash,
          message__action__to: response.events[0].message__action__to,
          message__action__type: response.events[0].message__action__type,
          message__token__domain: response.events[0].message__token__domain,
          message__token__id: response.events[0].message__token__id,
          message_body: response.events[0].message_body,
          message_hash: response.events[0].message_hash,
          message_type: response.events[0].message_type,
          new_root: response.events[0].new_root,
          nonce: response.events[0].nonce,
          old_root: response.events[0].old_root,
          origin_domain_id: response.events[0].origin_domain_id,
          origin_domain_name: response.events[0].origin_domain_name,
          process_block: response.events[0].process_block,
          process_tx: response.events[0].process_tx,
          processed_at: response.events[0].processed_at,
          recipient_address: response.events[0].recipient_address,
          relay_block: response.events[0].relay_block,
          relay_chain_id: response.events[0].relay_chain_id,
          relay_tx: response.events[0].relay_tx,
          relayed_at: response.events[0].relayed_at,
          sender_address: response.events[0].sender_address,
          signature: response.events[0].signature,
          update_block: response.events[0].update_block,
          update_chain_id: response.events[0].update_chain_id,
          update_tx: response.events[0].update_tx,
          updated_at: response.events[0].updated_at,

          send_tx: response.events[0].send_tx,
          sent_at: response.events[0].sent_at,
          send_block: response.events[0].send_block,
          receive_tx: response.events[0].receive_tx,
          origin_and_nonce: response.events[0].origin_and_nonce,
          receive_block: response.events[0].receive_block,
          received_at: response.events[0].received_at,
      };


      return r;
  }
}