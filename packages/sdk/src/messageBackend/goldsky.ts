import { BigNumber } from 'ethers';
import { request, gql } from 'graphql-request';
import { Dispatch } from '../messages';
import {MessageBackend} from './backend';
import * as config from '@nomad-xyz/configuration';

const defaultGoldSkySecret = "";

/**
 * Filter that is used to fetch data from GoldSky
 */
export type MessageFilter = {
    committedRoot: string, 
    messageHash: string,
    transactionHash: string;
};

/**
 * GoldSky NomadMessage representation
 */
export type GoldSkyMessage = {
    committed_root: string,
    destination_and_nonce: string,
    destination_domain_id: number,
    destination_domain_name: string,
    dispatch_block: string,
    dispatch_tx: string,
    dispatched_at: string,
    id: string,
    leaf_index: string,
    message: string,
    message__action__amount: string,
    message__action__details_hash: string,
    message__action__to: string,
    message__action__type: string,
    message__token__domain: string,
    message__token__id: string,
    message_body: string,
    message_hash: string,
    message_type: string,
    new_root: string,
    nonce: number,
    old_root: string,
    origin_domain_id: number,
    origin_domain_name: string,
    process_block: string,
    process_tx: string,
    processed_at: string,
    recipient_address: string,
    relay_block: string,
    relay_chain_id: number,
    relay_tx: string,
    relayed_at: string,
    sender_address: string,
    signature: string,
    update_block: string,
    update_chain_id: number,
    update_tx: string,
    updated_at: string,
}

/**
 * GoldSky backend for NomadMessage 
 */
export class GoldSkyBackend extends MessageBackend {
    env: string; // Unused yet, because GoldSky only has Production data
    protected _secret: string;

    messageCache: Map<string, GoldSkyMessage>;
    dispatchTxToMessageHash: Map<string, string>;

    constructor(env: string, secret: string) {
        super();
        this.env = env;
        this._secret = secret;

        this.messageCache = new Map();
        this.dispatchTxToMessageHash = new Map();
    }

    static checkEnvironment(environment: string) {
        if (environment != 'production') {
            throw new Error(`Only production environment is supported`);
        }
    }

    static default(environment: string | config.NomadConfig = 'development'): GoldSkyBackend {
        const environmentString = typeof environment === 'string' ? environment : environment.environment;

        GoldSkyBackend.checkEnvironment(environmentString);
        
        const secret = process.env.GOLDSKY_SECRET || defaultGoldSkySecret;
        if (!secret) throw new Error(`GOLDSKY_SECRET not found in env`);
        return new GoldSkyBackend(environmentString, secret);
    }

    /**
     * Fills filter with default values required for fetching a message from backend
     *
     * @returns Filled event filter
     */
     static fillFilter(f: Partial<MessageFilter>): MessageFilter {
        return {
            committedRoot: f.committedRoot || '',
            messageHash: f.messageHash || '',
            transactionHash: f.transactionHash || '',
        }
    }

    /**
     * Prepares a URI that is used for fetching messages
     *
     * @returns uri
     */
    get uri(): string {
        // return `https://${this.env}.goldsky.io/c/nomad/gql/v1/graphql`
        return `https://api.goldsky.io/c/nomad/gql/v1/graphql`
    }

    /**
     * Prepares a Dispatch event from backend's internal message representation
     *
     * @returns A Dispatch event assiciated with transaction (if any)
     */
    async getDispatch(tx: string): Promise<Dispatch | undefined> {
        const m = await this.getMessageByTx(tx);

        if (!m) return undefined;

        return {
            args: {
                messageHash: m.message_hash,
                leafIndex: BigNumber.from(m.leaf_index),
                destinationAndNonce: BigNumber.from(m.destination_and_nonce),
                committedRoot: m.committed_root,
                message: m.message,
            },
            transactionHash: m.dispatch_tx
        }
    }

    /**
     * Stores message into internal cache
     */
    storeMessage(m: GoldSkyMessage) {
        this.messageCache.set(m.message_hash, m);
        this.dispatchTxToMessageHash.set(m.dispatch_tx, m.message_hash);
    }

    /**
     * Get the message representation associated with this message (if any)
     * by message hash
     *
     * @returns A message representation (if any)
     */
    async getMessage(messageHash: string): Promise<GoldSkyMessage | undefined> {
        let m = this.messageCache.get(messageHash);
        if (!m) {
            m = await this.fetchMessage({
                messageHash
            });
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
    async getMessageByTx(tx: string): Promise<GoldSkyMessage | undefined> {
        let m: GoldSkyMessage | undefined;
        let messageHash = this.dispatchTxToMessageHash.get(tx);
        if (!messageHash) {
            m = await this.fetchMessage({
                transactionHash: tx
            });
            if (m) {
                this.storeMessage(m);
            }
        }

        return m;
    }


    /**
     * Get the `Dispatch` transaction hash associated with this message (if any)
     *
     * @returns A dispatch tx (if any)
     */
    async dispatchTx(messageHash: string): Promise<string | undefined> {
        let m = await this.getMessage(messageHash);
        return m?.dispatch_tx;
    }

    /**
     * Get the `Relay` transaction hash associated with this message (if any)
     *
     * @returns A relay tx (if any)
     */
    async relayTx(messageHash: string): Promise<string | undefined> {
        let m = await this.getMessage(messageHash);
        return m?.relay_tx;
    }

    /**
     * Get the `Update` transaction hash associated with this message (if any)
     *
     * @returns A update tx (if any)
     */
    async updateTx(messageHash: string): Promise<string | undefined> {
        let m = await this.getMessage(messageHash);
        return m?.update_tx;
    }

    /**
     * Get the `Process` transaction hash associated with this message (if any)
     *
     * @returns A relay tx (if any)
     */
    async processTx(messageHash: string): Promise<string | undefined> {
        let m = await this.getMessage(messageHash);
        return m?.process_tx;
    }

    /**
     * Get message hash associated with this message (if any)
     *
     * @returns A message hash (if any)
     */
    async getMessageHash(tx: string): Promise<string | undefined> {
        const m = await this.getMessageByTx(tx);
        return m?.message_hash;
    }

    /**
     * Calculates an expected confirmation timestamp from relayed event
     *
     * @returns Timestamp (if any)
     */
    async confirmAt(messageHash: string): Promise<Date | undefined> {
        const m = await this.getMessage(messageHash);
        if (m && m.relay_tx) {
            let intTs;
            try {
                intTs = parseInt(m.relayed_at!); // may throw
            } catch(e) {
                return undefined
            }
            if (intTs <= 946684800000) {
                throw new Error(`That could not be`);
            }
            const optimisticSeconds = 30*60*1000;
            const confirmAt = new Date(intTs + optimisticSeconds);
            return confirmAt;
        }
        return undefined
    }

    /**
     * Fetches internal message from backend
     *
     * @returns Internal message representation (if any)
     */
    async fetchMessage(f: Partial<MessageFilter>): Promise<GoldSkyMessage|undefined> {

          const query = gql`
            query Query($committedRoot: String, $messageHash: String, $transactionHash: String) {

                    events(where: {_or: [{dispatch_tx: {_eq: $transactionHash}}, {message_hash: {_eq: $messageHash}}, {old_root: {_eq: $committedRoot}}]}) {
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

        const r: GoldSkyMessage = {
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
        };


        return r;
    }
}

