import { dev, mainnet, staging } from '@nomad-xyz/sdk';

export function setRpcProviders(rpcs: any) {
  // register mainnet
  mainnet.registerRpcProvider('ethereum', rpcs.ethereumRpc);
  mainnet.registerRpcProvider('moonbeam', rpcs.moonbeamRpc);

  // register staging
  staging.registerRpcProvider('moonbasealpha', rpcs.moonbasealphaRpc);
  staging.registerRpcProvider('kovan', rpcs.kovanRpc);

  // register dev
  dev.registerRpcProvider('kovan', rpcs.kovanRpc);
  dev.registerRpcProvider('moonbasealpha', rpcs.moonbasealphaRpc);
}

export { mainnet, staging, dev };
