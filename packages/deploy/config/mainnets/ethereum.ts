import { ChainJson, toChain } from '../../src/chain';
import * as dotenv from 'dotenv';
import { CoreConfig } from '../../src/core/CoreDeploy';
import { BridgeConfig } from '../../src/bridge/BridgeDeploy';

dotenv.config();

const rpc = process.env.ETHEREUM_RPC;
if (!rpc) {
  throw new Error('Missing RPC URI');
}

export const chainJson: ChainJson = {
  name: 'ethereum',
  rpc,
  deployerKey: process.env.ETHEREUM_DEPLOYER_KEY,
  domain: 0x657468, // b'eth' interpreted as an int
  gas: {
    price: {
      maxFeePerGas: '400000000000', // 400 gwei
      maxPriorityFeePerGas: '4000000000', // 4 gwei
    },
  },
  chunk: 2000,
  timelag: 20,
};

export const chain = toChain(chainJson);

export const config: CoreConfig = {
  environment: 'prod',
  updater: '0x71dC76C07E92325e7Cc09117AB94310Da63Fc2b9',
  recoveryTimelock: 60 * 60 * 24, // 1 day
  recoveryManager: '0xda2f881f7f4e9d2b9559f97c7670472a85c1986a',
  optimisticSeconds: 60 * 30, // 30 minutes
  watchers: ['0x9782A3C8128f5D1BD3C9655d03181ba5b420883E'],
  governor: {
    domain: chainJson.domain,
    address: '0x93277b8f5939975b9e6694d5fd2837143afbf68a',
  },
  processGas: 850_000,
  reserveGas: 15_000,
};

export const bridgeConfig: BridgeConfig = {
  weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
};
