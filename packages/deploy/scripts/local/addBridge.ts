import * as tom from '../../config/local/tom';
import * as daffy from '../../config/local/daffy';
import { deployNewChainBridge } from '../../src/bridge';
import {
  BridgeDeploy,
  ExistingBridgeDeploy,
} from '../../src/bridge/BridgeDeploy';
import { getPathToDeployConfig } from '../../src/verification/readDeployOutput';

const path = getPathToDeployConfig('dev');

// Instantiate Existing Bridge Deploys
const tomDeploy = new ExistingBridgeDeploy(tom.chain, tom.bridgeConfig, path);

// Instantiate New Bridge Deploy
const daffyDeploy = new BridgeDeploy(daffy.chain, daffy.bridgeConfig, path);

deployNewChainBridge(daffyDeploy, tomDeploy);
