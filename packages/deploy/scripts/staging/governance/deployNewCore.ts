import * as rinkeby from '../../../config/testnets/rinkeby';
import * as moonbasealpha from '../../../config/testnets/moonbasealpha';
import * as kovan from '../../../config/testnets/kovan';
import { CoreDeploy, ExistingCoreDeploy } from '../../../src/core/CoreDeploy';
import { deployNewChain } from '../../../src/core';
import { getPathToDeployConfig } from '../../../src/verification/readDeployOutput';

const path = getPathToDeployConfig('staging');

// Instantiate existing governor deploy on Rinkeby
const rinkebyCoreDeploy = ExistingCoreDeploy.withPath(
  rinkeby.chain,
  rinkeby.stagingConfig,
  path,
);

// instantiate other existing deploys
const moonbasealphaCoreDeploy = ExistingCoreDeploy.withPath(
  moonbasealpha.chain,
  moonbasealpha.stagingConfig,
  path,
);

// make new Kovan core Deploy
const kovanCoreDeploy = new CoreDeploy(kovan.chain, kovan.stagingConfig);

// deploy Kovan core
deployNewChain(kovanCoreDeploy, rinkebyCoreDeploy, [moonbasealphaCoreDeploy]);
