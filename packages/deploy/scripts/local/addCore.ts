import * as tom from '../../config/local/tom';
import * as daffy from '../../config/local/daffy';
import { deployNewChain } from '../../src/core';
import { CoreDeploy, ExistingCoreDeploy } from '../../src/core/CoreDeploy';
import { getPathToDeployConfig } from '../../src/verification/readDeployOutput';

const path = getPathToDeployConfig('dev');

// Instantiate Existing Bridge Deploys
const tomDeploy = ExistingCoreDeploy.withPath(
  tom.chain,
  tom.devConfig,
  path,
  tom.chain.deployer,
);

// Instantiate New Bridge Deploy
const daffyDeploy = new CoreDeploy(daffy.chain, daffy.devConfig);

deployNewChain(daffyDeploy, tomDeploy);
