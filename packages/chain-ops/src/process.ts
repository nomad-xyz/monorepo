import { ethers } from 'ethers';
import { NomadContext, NomadMessage } from '@nomad-xyz/sdk';

type Env = 'production' | 'staging' | 'development';

// user-defined script values
const { PRIVATE_KEY, DEST_RPC_URL } = process.env;
const ORIGIN = 'rinkeby';
const DESTINATION = 'polygonmumbai';
const TRANSACTION = '';
const ENV: Env = 'staging';
console.log(`${ENV}: ${ORIGIN} to ${DESTINATION}`);

let nomadContext: NomadContext;

// instanitiate BridgeContext, register provider and signer
async function init(destination: string | number): Promise<void> {
  nomadContext = await NomadContext.fetch(ENV);
  if (DEST_RPC_URL) {
    const destDomain = nomadContext.resolveDomain(destination);
    nomadContext.registerRpcProvider(destDomain, DEST_RPC_URL);
  }

  // register signer
  if (!PRIVATE_KEY) {
    throw new Error('No private key configured');
  }
  const provider = nomadContext.getProvider(destination);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  nomadContext.registerSigner(destination, wallet);
  console.log('nomadContext initiated');
}

// loop over transactions in a batch and process each one, continue if there is an error
async function processTx(
  origin: string | number,
  txHash: string,
): Promise<void> {
  console.log(`processing ${txHash}`);
  const message: NomadMessage<NomadContext> =
    await NomadMessage.baseSingleFromTransactionHash(
      nomadContext,
      origin,
      txHash,
    );
  await message.process();
}

async function start() {
  await init(DESTINATION);
  await processTx(ORIGIN, TRANSACTION);
}
start();
