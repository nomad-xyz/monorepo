import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import { request, gql } from "graphql-request";
import { NomadContext } from "@nomad-xyz/sdk";

const nomadAPI = "https://bridge-indexer.prod.madlads.tools/";

export type IndexerTx = {
  origin: number;
  destination: number;
  leafIndex: string;
  sender: string;
  state: number;
  dispatchedAt: number;
  updatedAt: number;
  relayedAt: number;
  processedAt: number;
  receivedAt: number;
  dispatchTx: string;
  amount: string;
  decimals: number;
  tokenDomain: number;
  tokenId: string;
  confirmAt: number;
};

export async function getTransactionsForProcessing(
  domains: number[],
  address: string,
  page: number,
  states: number[],
  size: number
): Promise<Array<IndexerTx>> {
  const skip = size * (page - 1);
  const variables = JSON.stringify({
    where: {
      destination: {
        in: domains,
      },
      origin: {
        in: domains,
      },
      tokenDomain: {
        in: domains,
      },
      state: {
        in: states,
      },
    },
  });
  const query = gql`
      query Query($where: MessagesWhereInput) {
        findManyMessages(where: $where, take: ${size}, skip: ${skip}) {
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
          dispatchTx
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
      }`;
  return await request(`${nomadAPI}graphql`, query, variables).then(
    (res) => res.findManyMessages
  );
}

async function main() {
  // This uses a helper function defined in ./registerRpcs.ts
  // to register RPCs placed in environment variables
  type Env = 'production' | 'staging' | 'development'
  const environment: Env = 'production';
  const nomadContext = await NomadContext.fetch(environment);
  const bridgeContext = await BridgeContext.fetch('production');


  console.log(`Registered Domains: ${nomadContext.domainNames}`);

  // const bridgeContext = BridgeContext.fromNomadContext(core);
  const domainID = bridgeContext.resolveDomain('moonbeam');
  const txArray = await getTransactionsForProcessing(
    [domainID], 
    "moonbeam",
    1,
    [2, 3],
    100
  );
  txArray.forEach((transaction) => {
    // nomadContext.processByOriginDestinationAndLeaf(transaction.origin, transaction.destination, transaction.leafIndex);
    console.log('tx leaf index: %s', transaction.leafIndex);

  });
}

(async () => {
  await main();
})();
