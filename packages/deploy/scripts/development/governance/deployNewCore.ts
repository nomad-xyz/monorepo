import * as rinkeby from '../../../config/testnets/rinkeby';
import * as kovan from '../../../config/testnets/kovan';
import * as moonbasealpha from '../../../config/testnets/moonbasealpha';
import * as milkomedatestnet from '../../../config/testnets/milkomedatestnet';
import { CoreDeploy, ExistingCoreDeploy } from '../../../src/core/CoreDeploy';
import { deployNewChain } from '../../../src/core';
import { getPathToDeployConfig } from '../../../src/verification/readDeployOutput';

const path = getPathToDeployConfig('dev');

// Instantiate existing governor deploy on Rinkeby
const rinkebyCoreDeploy = ExistingCoreDeploy.withPath(
  rinkeby.chain,
  rinkeby.devConfig,
  path,
);

// instantiate other existing deploys
const moonbaseAlphaCoreDeploy = ExistingCoreDeploy.withPath(
  moonbasealpha.chain,
  moonbasealpha.devConfig,
  path,
);

const kovanCoreDeploy = ExistingCoreDeploy.withPath(
  kovan.chain,
  kovan.devConfig,
  path,
);

// Instantiate new milkomeda deploy
const milkomedatestnetCoreDeploy = new CoreDeploy(
  milkomedatestnet.chain,
  milkomedatestnet.devConfig,
);

// deploy Milkomeda core
deployNewChain(milkomedatestnetCoreDeploy, rinkebyCoreDeploy, [
  moonbaseAlphaCoreDeploy,
  kovanCoreDeploy,
]);
