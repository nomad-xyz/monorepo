import { ApolloClient, gql, InMemoryCache, HttpLink } from '@apollo/client';
import fetch from 'cross-fetch';

export function buildUri(environment: string) {
  switch (environment) {
    case 'staging':
      return 'https://bridge-indexer.staging.madlads.tools/graphql';
    case 'production':
      return 'https://bridge-indexer.prod.madlads.tools/graphql';
    case 'local':
      return 'http://localhost:8080/graphql';
    default:
      return 'https://bridge-indexer.dev.madlads.tools/graphql';
  }
}

export function getClient(uri: string) {
  const client = new ApolloClient({
    link: new HttpLink({
      uri: uri,
      fetch: fetch,
    }),
    cache: new InMemoryCache(),
  });
  return client;
}

export function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

export async function getAddresses(uri: string) {
  const client = getClient(uri);
  const GET_ADDRESSES_QUERY = gql`
    query FindManyMessages($where: MessagesWhereInput, $take: Int) {
      findManyMessages(where: $where, take: $take) {
        sender
      }
    }
  `;

  const GET_ADDRESSES_VARS = {
    where: {
      sender: {
        not: null,
      },
    },
    take: 800,
  };
  const { loading, data } = await client.query({
    query: GET_ADDRESSES_QUERY,
    variables: GET_ADDRESSES_VARS,
    fetchPolicy: 'no-cache',
  });

  const addresses = data.findManyMessages
    .map((entry) => entry.sender)
    .filter(onlyUnique);
  return addresses;
}

export async function getMessageHistory(uri: string, address: string) {
  const client = getClient(uri);
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
    where: {
      sender: {
        equals: `${address}`,
      },
    },
  };
  const { loading, data } = await client.query({
    query: GET_TRANSACTION_HISTORY,
    variables: HISTORY_VARS,
    fetchPolicy: 'no-cache',
  });
  return data;
}

export const getEvents = async (uri: string, address: string) => {
  const client = getClient(uri);
  const GET_EVENTS_QUERY = gql`
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

  const EVENTS_VARS = {
    where: {
      dispatchTx: {
        equals:
          '0x238b6369d1035b401779dee46ce1a91a31f9a2bdd9dbb32e999e41e9209b1651',
      },
    },
  };

  const { loading, data } = await client.query({
    query: GET_EVENTS_QUERY,
    variables: EVENTS_VARS,
    fetchPolicy: 'no-cache',
  });

  return data;
};
