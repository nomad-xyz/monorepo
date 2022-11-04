import { BigNumber } from 'ethers';
import { request, gql } from 'graphql-request';
import { Dispatch } from '../messages';
import {MessageBackend} from './backend';
import * as config from '@nomad-xyz/configuration';
import { NomadContext } from '..';

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
    context: NomadContext;

    messageCache: Map<string, GoldSkyMessage>;
    dispatchTxToMessageHash: Map<string, string[]>;

    constructor(env: string, secret: string, context: NomadContext) {
        super();
        this.env = env;
        this._secret = secret;

        this.messageCache = new Map();
        this.dispatchTxToMessageHash = new Map();
        this.context = context;
    }

    getContext(): NomadContext {
        return this.context;
    }

    static checkEnvironment(environment: string) {
        if (environment != 'production') {
            throw new Error(`Only production environment is supported`);
        }
    }

    static default(environment: string | config.NomadConfig = 'development', context?: NomadContext): GoldSkyBackend {
        const environmentString = typeof environment === 'string' ? environment : environment.environment;

        GoldSkyBackend.checkEnvironment(environmentString);
        
        const secret = process.env.GOLDSKY_SECRET || defaultGoldSkySecret;
        if (!secret) throw new Error(`GOLDSKY_SECRET not found in env`);

        // if (!context) {
        //     context = new NomadContext(environment);
        // }
        return new GoldSkyBackend(environmentString, secret, context || new NomadContext(environment));
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
    async getDispatches(tx: string, limit?: number): Promise<Dispatch[] | undefined> {
        const ms = await this.getMessagesByTx(tx, limit);

        if (!ms) return undefined;

        return ms.map(m => ({
            args: {
                messageHash: m.message_hash,
                leafIndex: BigNumber.from(m.leaf_index),
                destinationAndNonce: BigNumber.from(m.destination_and_nonce),
                committedRoot: m.committed_root,
                message: m.message,
            },
            transactionHash: m.dispatch_tx
        }))
    }

    /**
     * Stores message into internal cache
     */
    storeMessage(m: GoldSkyMessage) {
        this.messageCache.set(m.message_hash, m);
        const messageHashes = this.dispatchTxToMessageHash.get(m.dispatch_tx);
        if (!messageHashes) {
            this.dispatchTxToMessageHash.set(m.dispatch_tx, [m.message_hash])
        } else {
            if (!messageHashes.includes(m.message_hash)) messageHashes.push(m.message_hash);
        }
    }

    /**
     * Get the message representation associated with this message (if any)
     * by message hash
     *
     * @returns A message representation (if any)
     */
    async getMessage(messageHash: string, forceFetch=false): Promise<GoldSkyMessage | undefined> {
        let m = this.messageCache.get(messageHash);
        if (!m || forceFetch) {
            m = (await this.fetchMessages({
                messageHash
            }, 1))?.[0];
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
    async getMessagesByTx(tx: string, limit?: number, forceFetch=true): Promise<GoldSkyMessage[] | undefined> {
        let ms: GoldSkyMessage[] | undefined;
        let messageHashes = this.dispatchTxToMessageHash.get(tx);
        const enoughMessages = limit && messageHashes && limit <= messageHashes.length;
        if (!enoughMessages || forceFetch) {
            ms = await this.fetchMessages({
                transactionHash: tx
            });
            if (ms && ms.length) {
                ms.forEach(m => this.storeMessage(m))
            }
        } else {
            // messageHashes! are there as they are already tested in `enoughHashes` above
            // getMessage(hash)! is also there as in order to get into `messageHashes` a message needs to get fetched
            ms = await Promise.all(messageHashes!.map(async (hash) => {
                return (await this.getMessage(hash))!
            }));
        }

        return ms;
    }


    /**
     * Get the `Dispatch` transaction hash associated with this message (if any)
     *
     * @returns A dispatch tx (if any)
     */
    async dispatchTx(messageHash: string): Promise<string | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.dispatch_tx) m = await this.getMessage(messageHash, true);
        return m?.dispatch_tx;
    }

    /**
     * Get the `Relay` transaction hash associated with this message (if any)
     *
     * @returns A relay tx (if any)
     */
    async relayTx(messageHash: string): Promise<string | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.relay_tx) m = await this.getMessage(messageHash, true);
        return m?.relay_tx;
    }

    /**
     * Get the `Update` transaction hash associated with this message (if any)
     *
     * @returns A update tx (if any)
     */
    async updateTx(messageHash: string): Promise<string | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.update_tx) m = await this.getMessage(messageHash, true);
        return m?.update_tx;
    }

    /**
     * Get the `Process` transaction hash associated with this message (if any)
     *
     * @returns A relay tx (if any)
     */
    async processTx(messageHash: string): Promise<string | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.process_tx) m = await this.getMessage(messageHash, true);
        return m?.process_tx;
    }


    /**
     * Get the `Dispatch` transaction hash associated with this message (if any)
     *
     * @returns A dispatch tx (if any)
     */
     async dispatchedAt(messageHash: string): Promise<Date | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.dispatched_at) m = await this.getMessage(messageHash, true);
        return m ? new Date(m.dispatched_at): undefined;
     }

    /**
     * Get the `Relay` transaction hash associated with this message (if any)
     *
     * @returns A relay tx (if any)
     */
     async relayedAt(messageHash: string): Promise<Date | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.relayed_at) m = await this.getMessage(messageHash, true);
        return m ? new Date(m.relayed_at): undefined;
     }

    /**
     * Get the `Update` transaction hash associated with this message (if any)
     *
     * @returns A update tx (if any)
     */
    async updatedAt(messageHash: string): Promise<Date | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.updated_at) m = await this.getMessage(messageHash, true);
        return m ? new Date(m.updated_at): undefined;
    }

    /**
     * Get the `Process` transaction hash associated with this message (if any)
     *
     * @returns A relay tx (if any)
     */
    async processedAt(messageHash: string): Promise<Date | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.processed_at) m = await this.getMessage(messageHash, true);
        return m ? new Date(m.processed_at): undefined;
    }

    async destinationDomainId(messageHash: string): Promise<number | undefined> {
        let m = await this.getMessage(messageHash);
        if (!m?.destination_domain_id) m = await this.getMessage(messageHash, true);
        return m?.destination_domain_id;
    }

    /**
     * Get message hash associated with this message (if any)
     *
     * @returns A message hash (if any)
     */
    async getFirstMessageHash(tx: string): Promise<string | undefined> {
        const ms = await this.getMessagesByTx(tx);
        return ms?.[0]?.message_hash;
    }

    /**
     * Fetches internal message from backend
     *
     * @returns Internal message representation (if any)
     */
    async fetchMessages(f: Partial<MessageFilter>, limit?: number): Promise<GoldSkyMessage[]|undefined> {

          const query = gql`
            query Query($committedRoot: String, $messageHash: String, $transactionHash: String, $limit: Int) {

                    events(where: {_or: [{dispatch_tx: {_eq: $transactionHash}}, {message_hash: {_eq: $messageHash}}, {old_root: {_eq: $committedRoot}}]}, limit: $limit) {
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

        const filter = {
            ...GoldSkyBackend.fillFilter(f),
            limit: limit || null
        };
        

        const response = await request(this.uri, query, filter, headers);

        if (response.events.length <= 0) return undefined;
        // else if (limit && response.events.length > limit) throw new Error(`Transaction contains more than required Dispatch events`);

        return response.events.map((event: any) => {

            return {
                committed_root: event.committed_root,
                destination_and_nonce: event.destination_and_nonce,
                destination_domain_id: event.destination_domain_id,
                destination_domain_name: event.destination_domain_name,
                dispatch_block: event.dispatch_block,
                dispatch_tx: event.dispatch_tx,
                dispatched_at: event.dispatched_at,
                id: event.id,
                leaf_index: event.leaf_index,
                message: event.message,
                message__action__amount: event.message__action__amount,
                message__action__details_hash: event.message__action__details_hash,
                message__action__to: event.message__action__to,
                message__action__type: event.message__action__type,
                message__token__domain: event.message__token__domain,
                message__token__id: event.message__token__id,
                message_body: event.message_body,
                message_hash: event.message_hash,
                message_type: event.message_type,
                new_root: event.new_root,
                nonce: event.nonce,
                old_root: event.old_root,
                origin_domain_id: event.origin_domain_id,
                origin_domain_name: event.origin_domain_name,
                process_block: event.process_block,
                process_tx: event.process_tx,
                processed_at: event.processed_at,
                recipient_address: event.recipient_address,
                relay_block: event.relay_block,
                relay_chain_id: event.relay_chain_id,
                relay_tx: event.relay_tx,
                relayed_at: event.relayed_at,
                sender_address: event.sender_address,
                signature: event.signature,
                update_block: event.update_block,
                update_chain_id: event.update_chain_id,
                update_tx: event.update_tx,
                updated_at: event.updated_at,
            } as GoldSkyMessage;


        })
    }
}

