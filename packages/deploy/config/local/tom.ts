import * as dotenv from 'dotenv';

import { ChainJson, toChain } from '../../src/chain';
import { CoreConfig } from '../../src/core/CoreDeploy';
import { BridgeConfig } from '../../src/bridge/BridgeDeploy';
import { BigNumber } from 'ethers';

const TOM_RPC = 'http://127.0.0.1:9545';

dotenv.config();

const rpc = process.env.TOM_RPC || TOM_RPC;
const deployerKey = process.env.TOM_DEPLOYER_KEY;
const deployerAddress = process.env.TOM_DEPLOYER_ADDRESS;

if (!deployerKey) {
  throw new Error('No LOCAL_DEPLOYER_KEY among env variables');
}

if (!deployerAddress) {
  throw new Error('No LOCAL_DEPLOYER_ADDRESS among env variables');
}

const chainJson: ChainJson = {
  name: 'tom',
  rpc,
  deployerKey,
  domain: 1000,
  gas: { price: '10000000000' },
  chunk: 2000,
  timelag: 5,
};

export const chain = toChain(chainJson);

export const devConfig: CoreConfig = {
  environment: 'dev',
  updater: deployerAddress,
  optimisticSeconds: 10,
  watchers: [deployerAddress],
  recoveryTimelock: 180,
  recoveryManager: '0x24F6c874F56533d9a1422e85e5C7A806ED11c036',
  processGas: 850_000,
  reserveGas: 15_000,
};

export const stagingConfig: CoreConfig = {
  environment: 'staging',
  updater: deployerAddress,
  watchers: [deployerAddress],
  recoveryManager: '0x24F6c874F56533d9a1422e85e5C7A806ED11c036',
  optimisticSeconds: 10,
  recoveryTimelock: 180,
  processGas: 850_000,
  reserveGas: 15_000,
};

export const bridgeConfig: BridgeConfig = {
  //   weth: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
};
