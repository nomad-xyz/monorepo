// import { Dispatch, EventBase, Process, Update } from "./events";
// import { BigNumber } from 'ethers';
import { request, gql } from 'graphql-request';
// import { Dispatch } from '../messages/types';

import { Dispatch, EventFilter, EventResult } from "../NomadContext";


// export type BaseEvents = [((Dispatch & EventBase) | undefined), ((Update & EventBase) | undefined), ((Update & EventBase) | undefined), ((Process & EventBase) | undefined)];


// type BackendOptions = {
//     eventName?: string,
//     root?: string,
//     messageHash?: string,
// }

// export type DispatchFilter = {
//     committedRoot?: string, 
//     messageHash?: string,
//     transactionHash?: string;
// }

export default abstract class EventBackend<Filter, Result, Dispatch> {
    abstract getEvents(f: Partial<Filter>): Promise<Result>;
    abstract getDispatch(f: Partial<Filter>): Promise<Dispatch[]>;
}

// interface EventsFiler {
//     committedRoot: string,
//     messageHash: string,
// }



export class GoldSkyCoreBackend extends EventBackend<EventFilter, EventResult, Dispatch>{
    env: string;
    constructor(env: string) {
        super();
        this.env = env;
    }

    getUrl(): string {
        return `https://${this.env}.goldsky.io/c/nomad/gql/v1/graphql`
    }

    async getEvents(f: Partial<EventFilter>): Promise<EventResult> {
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
            query Query($committedRoot: String!, $messageHash: String!) {
                
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

        //   let events = [
            
        //   ]

        const response = await request(this.getUrl(), query, f, headers);
        // const dispatch = response.decoded_dispatch[0];
        // const dispatch = response.subgraph_dispatch[0];
        const update = response.subgraph_update[0];
        const relay = response.subgraph_update[1];
        const process = response.subgraph_process[0];


        let events: EventResult = {
        };

        // if (dispatch) {
        //     events.dispatch = {
        //         tag: "dispatch",
        //         leafIndex: dispatch.leaf_ndex,
        //         destinationAndNonce: dispatch.destination_and_nonce,
        //         committedRoot: dispatch.committed_root,
        //         message: dispatch.message,
        //         messageHash: dispatch.message_hash,
        //         transactionHash: dispatch.transaction_hash,
        //         timestamp: dispatch.timestamp,
        //     };
        // }

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
        // let events: BaseEvents = [
        //     // dispatch ? {
        //     //     block: parseInt(dispatch.block_number),
        //     //     transactionHash: dispatch.transaction_hash,
        //     //     timestamp: dispatch.timestamp,
        //     //     tag: "dispatch",
        //     //     messageHash: dispatch.message_hash,
        //     //     // leafIndex: ethers.BigNumber.from(0.1),
        //     //     destinationAndNonce: dispatch.destination_and_nonce,
        //     //     committedRoot: dispatch.committed_root,
        //     //     message: dispatch.message_body,
        //     // } as Dispatch & EventBase : undefined,
        //     update ? {
        //         block: parseInt(update.block_number),
        //         transactionHash: update.transaction_hash,
        //         timestamp: update.transaction_hash,
        //         tag: "update",
        //         homeDomain: update.home_domain,
        //         oldRoot: update.old_root,
        //         newRoot: update.new_root,
        //         signature: update.signature,
        //     } as Update : undefined,
        //     relay ? {
        //         block: parseInt(relay.block_number),
        //         transactionHash: relay.transaction_hash,
        //         timestamp: relay.transaction_hash,
        //         tag: "update",
        //         homeDomain: relay.home_domain,
        //         oldRoot: relay.old_root,
        //         newRoot: relay.new_root,
        //         signature: relay.signature,
        //     } as Update & EventBase: undefined,
        //     process ? {
        //         block: parseInt(process.block_number),
        //         transactionHash: process.transaction_hash,
        //         // contractId: 'ergergerg',
        //         timestamp: process.timestamp,
        //         tag: "process",
        //         messageHash: process.message_hash,
        //         success: process.success,
        //         returnData: process.return_data,
        //     } as Process & EventBase: undefined,
        // ];

        return events;
    }


    async getDispatch(f: Partial<EventFilter>): Promise<Dispatch[]> {
        console.log(`HEY! so there is a bug in Hasura, goldsky's graphql: more info here https://github.com/hasura/graphql-engine/issues/4488`);
        console.log(`tldr, it is not possible to use OR in WHERE query :'(( `);
        /*const query = gql`
            query Query($committedRoot: String, $messageHash: String, $transactionHash: String) {
                
                subgraph_dispatch(limit: 2, where: {_or: {transaction_hash: {_eq: $transactionHash}, message_hash: {_eq: $messageHash}, committed_root: {_eq: $committedRoot}}}) {
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
            }
          `;*/

        const query = gql`
            query Query($transactionHash: String!) {
                
                subgraph_dispatch(limit: 2, where: {transaction_hash: {_eq: $transactionHash}}) {
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
            }
          `;

          const headers = {
            "content-type": "application/json",
            "x-hasura-admin-secret": "yaZj76nCg5q"
          }

        //   let events = [
            
        //   ]

        const f1: {
            // committedRoot?: string;
            // messageHash?: string;
            transactionHash?: string;
        } = {
            // committedRoot: f.committedRoot || '',
            // messageHash: f.messageHash || '',
            transactionHash: f.transactionHash,
        }

        const response = await request(this.getUrl(), query, f1, headers);
        // const dispatch = response.decoded_dispatch[0];
        const dispatches: any[] = response.subgraph_dispatch;


        // let events: EventResult = {
        // };

        if (dispatches) {
            return dispatches.map(dispatch => {
                const d: Dispatch = {
                    tag: "dispatch",
                    // args: {
                    messageHash: dispatch.message_hash,
                    leafIndex: dispatch.leaf_index,
                    destinationAndNonce: dispatch.destination_and_nonce,
                    committedRoot: dispatch.committed_root,
                    message: dispatch.message,
                    //   },
                    transactionHash: dispatch.transaction_hash,
                    timestamp: dispatch.timestamp
                };
                return d;
            })
            
        } else {
            throw new Error(`No message found`)
        }
    }

}

