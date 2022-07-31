import {
  BridgeContext,
  BridgeMessage,
  TransferMessage,
} from '@nomad-xyz/sdk-bridge';
import { request, gql } from 'graphql-request';
import { ethers } from 'ethers';

const { PRIVATE_KEY, DEST_RPC_URL } = process.env;
const ENV = 'production';
const nomadAPI = 'https://bridge-indexer.prod.madlads.tools/graphql';
let bridgeContext: BridgeContext;
console.log(ENV);

export type IndexerTx = {
  origin: number;
  destination: number;
  leafIndex: string;
  state: number;
  dispatchTx: string;
};

// instanitiate BridgeContext, register provider and signer
export async function init(destination: string | number): Promise<void> {
  const bridgeContext = await BridgeContext.fetch(ENV);
  if (DEST_RPC_URL) {
    const destDomain = bridgeContext.resolveDomain(destination);
    bridgeContext.registerRpcProvider(destDomain, DEST_RPC_URL);
  }

  // register signer
  if (!PRIVATE_KEY) {
    throw new Error('No private key configured');
  }
  const provider = bridgeContext.getProvider('moonbeam');
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  bridgeContext.registerSigner('moonbeam', wallet);
  console.log('bridgeContext initiated');
}

// query indexer for unprocessed messages
export async function getUnprocessed(
  origin: string | number,
  destination: string | number,
  size: number,
  page: number,
): Promise<Array<IndexerTx>> {
  let take = size;
  if (!size || size > 100) {
    take = 100;
  }
  const skip = (page - 1) * take;

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
      findManyMessages(where: $where, take: ${take}, skip: ${skip}) {
        dispatchTx
        origin
        destination
        state
        leafIndex
      }
    }`;
  return await request(nomadAPI, query, variables).then(
    (res) => res.findManyMessages,
  );
}

// loop over transactions in a batch and process each one, continue if there is an error
export async function processBatch(
  origin: string | number,
  txArray: IndexerTx[],
): Promise<void> {
  console.log(`processing batch of ${txArray.length} transactions`);
  for (const transaction of txArray) {
    try {
      console.log(`fprocessing ${transaction.dispatchTx}`);
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
export async function processAll(
  origin: string | number,
  destination: string | number,
): Promise<void> {
  let queryNextBatch = true;
  let page = 1;
  while (queryNextBatch) {
    const txArray = await getUnprocessed(origin, destination, 100, page);
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
  const origin = 'ethereum';
  const destination = 'moonbeam';
  await init(destination);

  await processAll(origin, destination);
}
start();
