import { ChainJson, toChain } from '../../src/chain';
import * as dotenv from 'dotenv';
import { CoreConfig } from '../../src/core/CoreDeploy';
import { BridgeConfig } from '../../src/bridge/BridgeDeploy';

dotenv.config();

const rpc = process.env.MOONBASEALPHA_RPC;
if (!rpc) {
  throw new Error('Missing RPC URI');
}

export const chainJson: ChainJson = {
  name: 'moonbasealpha',
  rpc,
  deployerKey: process.env.MOONBASEALPHA_DEPLOYER_KEY,
  domain: 5000,
  gas: { price: '10000000000' },
  chunk: 2000,
  timelag: 5,
};

export const chain = toChain(chainJson);

export const devConfig: CoreConfig = {
  environment: 'dev',
  updater: '0x4177372FD9581ceb2367e0Ce84adC5DAD9DF8D55',
  watchers: ['0x20aC2FD664bA5406A7262967C34107e708dCb18E'],
  recoveryManager: '0xa4849f1D96B26066f9C631FCdc8F1457D27Fb5EC',
  optimisticSeconds: 10,
  recoveryTimelock: 180, // 3 minutes
  processGas: 850_000,
  reserveGas: 15_000,
};

export const stagingConfig: CoreConfig = {
  environment: 'staging',
  updater: '0xD39dd43eFDD867939A2F070469cB3e1252827466',
  watchers: ['0x1795f9A0a6853D6328241e9Dc37203cA545C3b79'],
  recoveryManager: '0xa4849f1D96B26066f9C631FCdc8F1457D27Fb5EC',
  optimisticSeconds: 60 * 30, // 30 minutes
  recoveryTimelock: 180, // 3 minutes
  processGas: 850_000,
  reserveGas: 15_000,
};

export const bridgeConfig: BridgeConfig = {
  weth: '0x674421e9567653ee76e96feea3b2b2966d000dbd',
};
