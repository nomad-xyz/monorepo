import * as rinkeby from '../../../config/testnets/rinkeby';
import * as milkomedatestnet from '../../../config/testnets/milkomedatestnet';
import { ExistingCoreDeploy } from '../../../src/core/CoreDeploy';
import { ExistingBridgeDeploy } from '../../../src/bridge/BridgeDeploy';
import { getPathToDeployConfig } from '../../../src/verification/readDeployOutput';
import { deploysToSDK } from '../../../src/incremental/utils';
import { checkHubAndSpokeConnections } from '../../../src/incremental/checks';
import { NomadContext } from '@nomad-xyz/sdk';

const path = getPathToDeployConfig('dev');

// Instantiate existing governor deploy on Rinkeby
const rinkebyCoreDeploy = ExistingCoreDeploy.withPath(
  rinkeby.chain,
  rinkeby.devConfig,
  path,
);
const rinkebyBridgeDeploy = new ExistingBridgeDeploy(
  rinkeby.chain,
  rinkeby.bridgeConfig,
  path,
);
const rinkebyDomain = deploysToSDK(rinkebyCoreDeploy, rinkebyBridgeDeploy);

// Enroll milkomedatestnet as spoke to Rinkeby hub
const milkomedatestnetCoreDeploy = ExistingCoreDeploy.withPath(
  milkomedatestnet.chain,
  milkomedatestnet.devConfig,
  path,
);
const milkomedatestnetBridgeDeploy = new ExistingBridgeDeploy(
  milkomedatestnet.chain,
  milkomedatestnet.bridgeConfig,
  path,
);
const milkomedatestnetDomain = deploysToSDK(
  milkomedatestnetCoreDeploy,
  milkomedatestnetBridgeDeploy,
);

// setup SDK
const sdkDomains = [rinkebyDomain, milkomedatestnetDomain];
const sdk = NomadContext.fromDomains(sdkDomains);
const sdkCores = [rinkebyCoreDeploy, milkomedatestnetCoreDeploy];
sdkCores.forEach((core) => {
  sdk.registerProvider(core.chain.domain, core.provider);
  sdk.registerSigner(core.chain.domain, core.deployer);
});

checkHubAndSpokeConnections(
  sdk,
  milkomedatestnetDomain.id,
  milkomedatestnet.devConfig.watchers,
);
