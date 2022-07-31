import { BridgeContext, BridgeMessage, TransferMessage } from '@nomad-xyz/sdk-bridge'
import { request, gql } from 'graphql-request'
import { ethers } from 'ethers'

const nomadAPI = 'https://bridge-indexer.prod.madlads.tools/graphql'

export type IndexerTx = {
  origin: number
  destination: number
  leafIndex: string
  sender: string
  state: number
  dispatchedAt: number
  updatedAt: number
  relayedAt: number
  processedAt: number
  receivedAt: number
  dispatchTx: string
  amount: string
  decimals: number
  tokenDomain: number
  tokenId: string
  confirmAt: number
}

export async function getUnprocessed(
  origin: number,
  destination: number,
  size: number
): Promise<Array<IndexerTx>> {
  let take = size
  if (!size || size > 100) {
    take = 100
  }
  const variables = JSON.stringify({
    where: {
      destination: {
        equals: destination,
      },
      origin: {
        equals: origin,
      },
      state: {
        in: [2, 3],
      },
    },
  })
  const query = gql`
    query Query($where: MessagesWhereInput) {
      findManyMessages(where: $where, take: ${take}) {
        dispatchTx
        origin
        destination
        state
      }
    }`
  return await request(nomadAPI, query, variables).then(
    (res) => res.findManyMessages
  )
}


export const processAll = async (origin: string | number, destination: string | number) => {
  const { PRIVATE_KEY, MOONBEAM_RPC } = process.env;
  const bridgeContext = await BridgeContext.fetch('production');
  bridgeContext.registerRpcProvider('moonbeam', MOONBEAM_RPC!);

  // get signer
  if (!PRIVATE_KEY) {
    throw new Error('No private key configured');
  }
  // add deploy signer and overrides for each network
  const provider = bridgeContext.getProvider('moonbeam');
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  bridgeContext.registerSigner('moonbeam', wallet);

  const originDomain = bridgeContext.resolveDomain(origin);
  const destDomain = bridgeContext.resolveDomain(destination);
  const txArray = await getUnprocessed(
    originDomain,
    destDomain,
    10,
  );
  console.log('txs', txArray)
  for (const transaction of txArray) {
    try {
      const message: TransferMessage = await BridgeMessage.singleFromTransactionHash(bridgeContext, originDomain, transaction.dispatchTx);
      await message.process();
    } catch(e) {
      console.log(transaction.dispatchTx, e)
    }
  }
}
processAll('ethereum', 'moonbeam')