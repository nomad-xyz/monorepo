import { ChainJson, toChain } from '../../src/chain';
import * as dotenv from 'dotenv';
import { CoreConfig } from '../../src/core/CoreDeploy';
import { BridgeConfig } from '../../src/bridge/BridgeDeploy';

dotenv.config();

const rpc = process.env.MOONBEAM_RPC;
if (!rpc) {
  throw new Error('Missing RPC URI');
}

export const chainJson: ChainJson = {
  name: 'moonbeam',
  rpc,
  deployerKey: process.env.MOONBEAM_DEPLOYER_KEY,
  domain: 0x6265616d, // b'beam' interpreted as an int
  gas: { price: '150000000000' }, // moonbeam set minimum gas to 100 gwei; we will default to 150 gwei
  chunk: 2000,
  timelag: 20,
};

export const chain = toChain(chainJson);

export const config: CoreConfig = {
  environment: 'prod',
  updater: '0x40FD91557B318BD5d52D12535795265c88702681',
  recoveryTimelock: 60 * 60 * 24, // 1 day
  recoveryManager: '0xea24Ac04DEFb338CA8595C3750E20166F3b4998A',
  optimisticSeconds: 60 * 30, // 30 minutes
  watchers: ['0x297BBC2F2EAAEB17Ee53F514020bC8173F0570dC'],
  processGas: 850_000,
  reserveGas: 15_000,
};

export const bridgeConfig: BridgeConfig = {
  weth: '0xAcc15dC74880C9944775448304B263D191c6077F',
};
