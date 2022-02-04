import { ChainJson, toChain } from '../../src/chain';
import * as dotenv from 'dotenv';
import { CoreConfig } from '../../src/core/CoreDeploy';
import { BridgeConfig } from '../../src/bridge/BridgeDeploy';

dotenv.config();

const rpc = process.env.ASTAR_RPC;
if (!rpc) {
  throw new Error('Missing RPC URI');
}

export const chainJson: ChainJson = {
  name: 'astar',
  rpc,
  deployerKey: process.env.ASTAR_DEPLOYER_KEY,
  domain: 0x61737472, // b'astr' interpreted as an int
  gas: { price: '150000000000' }, // astar set minimum gas to 100 gwei; we will default to 150 gwei
  chunk: 2000,
  timelag: 20,
};

export const chain = toChain(chainJson);

export const config: CoreConfig = {
  environment: 'prod',
  updater: '0x72a9f9ABB2dA5c2Fc3FdBcD88813D342227DC37E',
  recoveryTimelock: 60 * 60 * 24, // 1 day
  recoveryManager: '0xea24Ac04DEFb338CA8595C3750E20166F3b4998A',
  optimisticSeconds: 60 * 30, // 30 minutes
  watchers: ['0xD653414d8B55BF4EC0111a2F5bf60eF994f23Bd7'],
  processGas: 850_000,
  reserveGas: 15_000,
};

export const bridgeConfig: BridgeConfig = {
  weth: '0xAeaaf0e2c81Af264101B9129C00F4440cCF0F720',
};
