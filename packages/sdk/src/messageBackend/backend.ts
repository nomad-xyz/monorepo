import { BigNumber } from 'ethers';
import { request, gql } from 'graphql-request';
import { Dispatch } from '../messages/types';

export type EventFilter = {
    committedRoot: string, 
    messageHash: string,
    transactionHash: string;
  };


export default abstract class MessageBackend {
    abstract getDispatch(tx: string): Promise<Dispatch | undefined>;
    abstract getMessageHash(tx: string): Promise<string | undefined>;
    abstract dispatchTx(messageHash: string): Promise<string | undefined>;
    abstract updateTx(messageHash: string): Promise<string | undefined>;
    abstract relayTx(messageHash: string): Promise<string | undefined>;
    abstract processTx(messageHash: string): Promise<string | undefined>;
    abstract confirmAt(messageHash: string): Promise<Date | undefined>;
}


export type ErinMessageResult = {
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


export class ErinBackend extends MessageBackend {
    env: string;
    protected _secret: string;

    messageCache: Map<string, ErinMessageResult>;
    dispatchTxToMessageHash: Map<string, string>;

    constructor(env: string, secret: string) {
        super();
        this.env = env;
        this._secret = secret;

        this.messageCache = new Map();
        this.dispatchTxToMessageHash = new Map();
    }

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

    storeMessage(m: ErinMessageResult) {
        this.messageCache.set(m.message_hash, m);
        this.dispatchTxToMessageHash.set(m.dispatch_tx, m.message_hash);
    }

    async getMessage(messageHash: string): Promise<ErinMessageResult | undefined> {
        let m = this.messageCache.get(messageHash);
        if (!m) {
            m = await this.getEvents({
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
    async getMessageByTx(tx: string): Promise<ErinMessageResult | undefined> {
        let m: ErinMessageResult | undefined;
        let messageHash = this.dispatchTxToMessageHash.get(tx);
        if (!messageHash) {
            m = await this.getEvents({
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

    getUrl(): string {
        return `https://${this.env}.goldsky.io/c/nomad/gql/v1/graphql`
    }

    static fillFilter(f: Partial<EventFilter>) {
        return {
            committedRoot: f.committedRoot || '',
            messageHash: f.messageHash || '',
            transactionHash: f.transactionHash || '',
        }
    }

    async getEvents(f: Partial<EventFilter>): Promise<ErinMessageResult|undefined> {

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

        const response = await request(this.getUrl(), query, ErinBackend.fillFilter(f), headers);

        if (response.events.length <= 0) return undefined;

        const r: ErinMessageResult = {
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

