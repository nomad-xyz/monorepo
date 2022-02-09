import * as ethers from 'ethers';

import { mainnet } from './BridgeContext';

const celoTokenAddr = '0x471EcE3750Da237f93B8E339c536989b8978a438';

const amount = ethers.constants.WeiPerEther.mul(100);
const privkey = process.env.PRIVKEY_LMAO;
if (!privkey) {
  throw new Error('set PRIVKEY_LMAO');
}

const celoRpc = 'https://forno.celo.org';
mainnet.registerRpcProvider('celo', celoRpc);
mainnet.registerWalletSigner('celo', privkey);

async function doThing() {
  const address = await mainnet.getAddress('celo');
  if (!address) {
    throw new Error('no address');
  }

  const message = await mainnet.send(
    'celo',
    'ethereum',
    { domain: 'celo', id: celoTokenAddr },
    amount,
    address,
  );
  console.log(`sendTx is ${message.transactionHash}`);
  await message.wait();
}

doThing();
