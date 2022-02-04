import * as rinkeby from '../../../config/testnets/rinkeby';
import * as kovan from '../../../config/testnets/kovan';
import { ExistingCoreDeploy } from '../../../src/core/CoreDeploy';
import { ExistingBridgeDeploy } from '../../../src/bridge/BridgeDeploy';
import { getPathToDeployConfig } from '../../../src/verification/readDeployOutput';
import { deploysToSDK } from '../../../src/incremental/utils';
import { checkHubAndSpokeConnections } from '../../../src/incremental/checks';
import { NomadContext } from '@nomad-xyz/sdk';

const path = getPathToDeployConfig('staging');

// Instantiate existing governor deploy on Rinkeby
const rinkebyCoreDeploy = ExistingCoreDeploy.withPath(
  rinkeby.chain,
  rinkeby.stagingConfig,
  path,
);
const rinkebyBridgeDeploy = new ExistingBridgeDeploy(
  rinkeby.chain,
  rinkeby.bridgeConfig,
  path,
);
const rinkebyDomain = deploysToSDK(rinkebyCoreDeploy, rinkebyBridgeDeploy);

// Enroll Kovan as spoke to Rinkeby hub
const kovanCoreDeploy = ExistingCoreDeploy.withPath(
  kovan.chain,
  kovan.stagingConfig,
  path,
);
const kovanBridgeDeploy = new ExistingBridgeDeploy(
  kovan.chain,
  kovan.bridgeConfig,
  path,
);
const kovanDomain = deploysToSDK(kovanCoreDeploy, kovanBridgeDeploy);

// setup SDK
const sdkDomains = [rinkebyDomain, kovanDomain];
const sdk = NomadContext.fromDomains(sdkDomains);
const sdkCores = [rinkebyCoreDeploy, kovanCoreDeploy];
sdkCores.forEach((core) => {
  sdk.registerProvider(core.chain.domain, core.provider);
  sdk.registerSigner(core.chain.domain, core.deployer);
});

checkHubAndSpokeConnections(sdk, kovanDomain.id, kovan.stagingConfig.watchers);
