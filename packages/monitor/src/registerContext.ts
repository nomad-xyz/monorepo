import { NomadContext } from '@nomad-xyz/sdk';

let nomadContext: NomadContext;

export function setRpcProviders(rpcs: any) {
  // register mainnet
  nomadContext.registerRpcProvider('ethereum', rpcs.ethereumRpc);
  nomadContext.registerRpcProvider('moonbeam', rpcs.moonbeamRpc);

  // register staging
  nomadContext.registerRpcProvider('moonbasealpha', rpcs.moonbasealphaRpc);
  nomadContext.registerRpcProvider('kovan', rpcs.kovanRpc);

  // register dev
  nomadContext.registerRpcProvider('kovan', rpcs.kovanRpc);
  nomadContext.registerRpcProvider('moonbasealpha', rpcs.moonbasealphaRpc);
}

export { nomadContext };
