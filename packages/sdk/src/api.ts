import { request, gql } from 'graphql-request';

const { NOMAD_API } = process.env;

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

export async function getEvents(dispatchTx: string): Promise<IndexerTx> {
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
