import {
  BridgeContext,
  BridgeMessage,
  TransferMessage,
} from '@nomad-xyz/sdk-bridge';
import { request, gql } from 'graphql-request';
import { ethers } from 'ethers';

type Env = 'production' | 'staging' | 'development'

// user-defined script values
const { PRIVATE_KEY, DEST_RPC_URL } = process.env;
const ORIGIN = 'ethereum';
const DESTINATION = 'moonbeam';
const ENV: Env = 'production';
const PAGE_SIZE = 100;
console.log(`${ENV}: ${ORIGIN} to ${DESTINATION}`);

const NOMAD_API = getApiUrl();

let bridgeContext: BridgeContext;

type IndexerTx = {
  origin: number;
  destination: number;
  leafIndex: string;
  state: number;
  dispatchTx: string;
};

function getApiUrl(): string {
  let env = '';
  switch(ENV) {
    case 'production':
      env = 'prod';
      break;
    case 'development':
      env = 'dev';
      break;
    default:
      env = ENV
  }
  return `https://bridge-indexer.${env}.madlads.tools/graphql`
}

// instanitiate BridgeContext, register provider and signer
async function init(destination: string | number): Promise<void> {
  bridgeContext = await BridgeContext.fetch(ENV);
  if (DEST_RPC_URL) {
    const destDomain = bridgeContext.resolveDomain(destination);
    bridgeContext.registerRpcProvider(destDomain, DEST_RPC_URL);
  }

  // register signer
  if (!PRIVATE_KEY) {
    throw new Error('No private key configured');
  }
  const provider = bridgeContext.getProvider(destination);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  bridgeContext.registerSigner(destination, wallet);
  console.log('bridgeContext initiated');
}

// query indexer for unprocessed messages
export async function getUnprocessed(
  origin: string | number,
  destination: string | number,
  page: number,
): Promise<Array<IndexerTx>> {
  const skip = (page - 1) * PAGE_SIZE;

  const originDomain = bridgeContext.resolveDomain(origin);
  const destDomain = bridgeContext.resolveDomain(destination);

  const variables = JSON.stringify({
    where: {
      origin: {
        equals: originDomain,
      },
      destination: {
        equals: destDomain,
      },
      state: {
        in: [2, 3],
      },
    },
  });
  const query = gql`
    query Query($where: MessagesWhereInput) {
      findManyMessages(where: $where, take: ${PAGE_SIZE}, skip: ${skip}) {
        dispatchTx
        origin
        destination
        state
        leafIndex
      }
    }`;
  return await request(NOMAD_API, query, variables).then(
    (res) => res.findManyMessages,
  );
}

// loop over transactions in a batch and process each one, continue if there is an error
async function processBatch(
  origin: string | number,
  txArray: IndexerTx[],
): Promise<void> {
  console.log(`processing batch of ${txArray.length} transactions`);
  for (let i = 0; i < txArray.length; i++) {
    const transaction = txArray[i];
      try {
      console.log(`processing ${transaction.dispatchTx} - ${i} of ${txArray.length}`);
      const message: TransferMessage =
        await BridgeMessage.singleFromTransactionHash(
          bridgeContext,
          origin,
          transaction.dispatchTx,
        );
      await message.process();
    } catch (e) {
      // if error, log and continue to next transaction
      console.log(e);
    }
  }
}

// query and submit batches for all pending transactions
async function processAll(
  origin: string | number,
  destination: string | number,
): Promise<void> {
  let queryNextBatch = true;
  let page = 1;
  while (queryNextBatch) {
    const txArray = await getUnprocessed(origin, destination, page);
    if (txArray.length > 0) {
      await processBatch(origin, txArray);
      page += 1;
    } else {
      queryNextBatch = false;
      return;
    }
  }
}

async function start() {
  await init(DESTINATION);
  await processAll(ORIGIN, DESTINATION);
}
start();
