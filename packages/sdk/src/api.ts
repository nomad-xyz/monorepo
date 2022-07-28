import { request, gql } from 'graphql-request';

export type IndexerTx = {
  origin?: number;
  destination?: number;
  nonce?: number;
  root?: string;
  messageHash?: string;
  leafIndex?: string;
  sender?: string;
  state?: number;
  dispatchedAt?: number;
  updatedAt?: number;
  relayedAt?: number;
  processedAt?: number;
  receivedAt?: number;
  dispatchTx?: string;
  updateTx?: string;
  relayTx?: string;
  processTx?: string;
  body?: string;
  dispatchBlock?: number;
  internalSender?: string;
  internalRecipient?: string;
  msgType?: number;
  recipient?: string;
  amount?: string;
  allowFast?: boolean;
  detailsHash?: string;
  decimals?: number;
  tokenDomain?: number;
  tokenId?: string;
  confirmAt?: number;
  gasAtDispatch?: string;
  gasAtUpdate?: string;
  gasAtRelay?: string;
  gasAtReceive?: string;
  gasAtProcess?: string;
  sent?: boolean;
  updated?: boolean;
  relayed?: boolean;
  received?: boolean;
  processed?: boolean;
};

function getGqlUrl(environment: string): string {
  let env = '';
  switch (environment) {
    case 'development':
      env = 'dev';
      break;
    case 'production':
      env = 'prod';
      break;
    default:
      env = environment;
  }
  return `https://bridge-indexer.${env}.madlads.tools/graphql`;
}

export async function getEvents(
  env: string,
  dispatchTx: string,
): Promise<IndexerTx> {
  const NOMAD_API = getGqlUrl(env);
  const variables = JSON.stringify({
    where: {
      dispatchTx: {
        equals: dispatchTx,
      },
    },
  });
  const query = gql`
    query Query($where: MessagesWhereInput) {
      findFirstMessages(where: $where) {
        root
        state
        updated
        relayed
        processed
        dispatchedAt
        updatedAt
        relayedAt
        processedAt
        processTx
        confirmAt
      }
    }
  `;
  return await request(`${NOMAD_API}`, query, variables).then(async (res) => {
    console.log('result:\n', res.findFirstMessages);
    return res.findFirstMessages;
  });
}
