import { step, TestSettings, beforeAll} from '@flood/element'
import { ApolloClient, gql, InMemoryCache, HttpLink } from '@apollo/client';
import fetch from 'cross-fetch';

export const settings: TestSettings = {
	userAgent: 'flood-load-test',
	loopCount: 50,
    actionDelay: 0.5,
    stages: [
        { duration: '1m', target: 5 },
        { duration: '5m', target: 30 },
        { duration: '1m', target: 5 },
    ]
}


let myClient: any;
let addresses = [
    "0xF5e6CC7FA0bf3c96B3def2863eC0dC03ce5DC737",
    "0x9791c9dF02D34F2e7d7322D655535d9849E8da5c",
    "0x952318478309f711268796d89544E6421C0fC12A"
]


export default () => {
    beforeAll(async browser => {
		// Run this hook before running the first step
		myClient = new ApolloClient({
            link: new HttpLink({
                uri: 'https://bridge-indexer.dev.madlads.tools/graphql',
                fetch: fetch
            }),
            cache: new InMemoryCache() 
        });
	})
    step("Query Tx History", async () => {
        const address = addresses[Math.floor(Math.random() * addresses.length)]

        const GET_TRANSACTION_HISTORY = gql`
          query Query($where: MessagesWhereInput) {
            findManyMessages(where: $where, take: 10, skip: 0) {
              id
              messageHash
              origin
              destination
              nonce
              internalSender
              internalRecipient
              msgType
              root
              state
              dispatchBlock
              dispatchedAt
              updatedAt
              relayedAt
              receivedAt
              processedAt
              confirmAt
              sender
              recipient
              amount
              allowFast
              detailsHash
              tokenDomain
              tokenId
              body
              leafIndex
              tx
              gasAtDispatch
              gasAtUpdate
              gasAtRelay
              gasAtReceive
              gasAtProcess
              sent
              updated
              relayed
              received
              processed
              createdAt
            }
          }
        `;
        
        const HISTORY_VARS = {
            "where": {
              "OR": [
                {
                  "recipient": {
                    "equals": `${address}`
                  },
                  "sender": {
                    "equals": `${address}`
                  }
                }
              ]
            }
        }
        const {loading, data} = await myClient.query({
            query: GET_TRANSACTION_HISTORY,
            fetchPolicy: "no-cache" 
        });
        console.log(`Address: ${address}`)
        console.log(`Number Messages: ${data.findManyMessages.length}`)
    })
};