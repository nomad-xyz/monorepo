import * as dotenv from 'dotenv';

import { ChainJson, toChain } from '../../src/chain';
import { CoreConfig } from '../../src/core/CoreDeploy';
import { BridgeConfig } from '../../src/bridge/BridgeDeploy';

dotenv.config();

const rpc = process.env.MILKOMEDA_TESTNET_RPC;
if (!rpc) {
  throw new Error('Missing RPC URI');
}

const chainJson: ChainJson = {
  name: 'milkomedatestnet',
  rpc,
  deployerKey: process.env.MILKOMEDA_TESTNET_DEPLOYER_KEY,
  domain: 8000,
  gas: { price: '100000000000' },
  chunk: 2000,
  timelag: 5,
};

export const chain = toChain(chainJson);

export const devConfig: CoreConfig = {
  environment: 'dev',
  updater: '0x4177372FD9581ceb2367e0Ce84adC5DAD9DF8D55',
  optimisticSeconds: 10,
  watchers: ['0x20aC2FD664bA5406A7262967C34107e708dCb18E'],
  recoveryTimelock: 180, // 3 minutes
  recoveryManager: '0xa4849f1D96B26066f9C631FCdc8F1457D27Fb5EC',
  processGas: 850_000,
  reserveGas: 15_000,
};

export const stagingConfig: CoreConfig = {
  environment: 'staging',
  updater: '0x5340fe2F454B861E71647bd80596A3463e095C9c',
  watchers: ['0xa031973b293B924f6C848202Bf1dc3107fDE4D1e'],
  recoveryManager: '0xa4849f1D96B26066f9C631FCdc8F1457D27Fb5EC',
  optimisticSeconds: 60 * 30, // 30 minutes
  recoveryTimelock: 180, // 3 minutes
  processGas: 850_000,
  reserveGas: 15_000,
};

export const bridgeConfig: BridgeConfig = {
  weth: '0x6942F4eD908bF1F294e25497624ad228d178D54C',
};
