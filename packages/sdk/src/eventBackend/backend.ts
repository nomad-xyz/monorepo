import { request, gql } from 'graphql-request';

import { EventFilter, EventResult } from "../NomadContext";



export default abstract class EventBackend<Filter, Result> {
    abstract getEvents(f: Filter): Promise<Result>;
}




export class GoldSkyCoreBackend extends EventBackend<Partial<EventFilter>, Partial<EventResult>>{
    env: string;
    constructor(env: string) {
        super();
        this.env = env;
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

    async getEvents(f: Partial<EventFilter>): Promise<Partial<EventResult>> {
        // const variables = {
        //     committed_root: f.committedRoot,
        //     message_hash: f.messageHash,
        // };

        // decoded_dispatch(limit: 1, where: {committed_root: {_eq: $committed_root}, message_hash: {_eq: $message_hash}}) {
        //     _gs_chain
        //     action_body
        //     block_number
        //     committed_root
        //     contract_id
        //     destination_and_nonce
        //     destination_domain_id
        //     destination_domain_name
        //     id
        //     message
        //     message__action__amount
        //     message__action__details_hash
        //     message__action__to
        //     message__action__type
        //     message__token__domain
        //     message__token__domain_name
        //     message__token__id
        //     message__token_body
        //     message_body
        //     message_hash
        //     message_type
        //     nonce
        //     origin_domain_id
        //     origin_domain_name
        //     recipient_address
        //     transaction_hash
        //     timestamp
        //     sender_address
        //   }

          const query = gql`
            query Query($committedRoot: String, $messageHash: String, $transactionHash: String) {

                subgraph_dispatch(limit: 2, where: {_or: [{transaction_hash: {_eq: $transactionHash}}, {message_hash: {_eq: $messageHash}}, {committed_root: {_eq: $committedRoot}}]}) {
                    block
                    block_number
                    committed_root
                    contract_id
                    destination_and_nonce
                    id
                    leaf_index
                    message
                    message_hash
                    timestamp
                    transaction_hash
                  }
                
                  subgraph_update(limit: 2, where: {new_root: {_eq: $committedRoot}}) {
                    block
                    block_number
                    contract_id
                    home_domain
                    id
                    new_root
                    old_root
                    signature
                    timestamp
                    transaction_hash
                  }
                  subgraph_process(limit: 1, where: {message_hash: {_eq: $messageHash}}) {
                    block
                    block_number
                    contract_id
                    id
                    message_hash
                    return_data
                    success
                    timestamp
                    transaction_hash
                    vid
                  }
            }
          `;

          const headers = {
            "content-type": "application/json",
            "x-hasura-admin-secret": "yaZj76nCg5q"
          }


        const response = await request(this.getUrl(), query, GoldSkyCoreBackend.fillFilter(f), headers);
        if (response.subgraph_dispatch > 1) throw new Error(`More than one dispatch found for the query`);
        const dispatch = response.subgraph_dispatch[0];
        const update = response.subgraph_update[0];
        const relay = response.subgraph_update[1];
        const process = response.subgraph_process[0];


        let events: Partial<EventResult> = {
        };

        if (dispatch) {
            events.dispatch = {
                tag: "dispatch",
                leafIndex: dispatch.leaf_index,
                destinationAndNonce: dispatch.destination_and_nonce,
                committedRoot: dispatch.committed_root,
                message: dispatch.message,
                messageHash: dispatch.message_hash,
                transactionHash: dispatch.transaction_hash,
                timestamp: dispatch.timestamp,
            };
        }

        if (update) {
            events.update = {
                tag: "update",
                homeDomain: update.home_domain,
                oldRoot: update.old_root,
                newRoot: update.new_root,
                signature: update.signature,
                transactionHash: update.transaction_hash,
                timestamp: update.timestamp,
            };
        }

        if (relay) {
            events.relay = {
                tag: "update",
                homeDomain: relay.home_domain,
                oldRoot: relay.old_root,
                newRoot: relay.new_root,
                signature: relay.signature,
                transactionHash: relay.transaction_hash,
                timestamp: relay.timestamp,
            };
        }

        if (process) {
            events.process = {
                tag: "process",
                transactionHash: process.transaction_hash,
                timestamp: process.timestamp,
                messageHash: process.message_hash,
                success: process.success,
                returnData: process.return_data,
            };
        }

        return events;
    }
}

