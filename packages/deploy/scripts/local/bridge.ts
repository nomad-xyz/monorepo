import * as tom from '../../config/local/tom';
import * as jerry from '../../config/local/jerry';
import { getPathToDeployConfig } from '../../src/verification/readDeployOutput';
import { deployBridgesHubAndSpoke } from '../../src/bridge';
import { BridgeDeploy } from '../../src/bridge/BridgeDeploy';

// get the path to the latest core system deploy
const path = getPathToDeployConfig('dev');

const tomDeploy = new BridgeDeploy(tom.chain, tom.bridgeConfig, path);
const jerryDeploy = new BridgeDeploy(jerry.chain, jerry.bridgeConfig, path);

deployBridgesHubAndSpoke(tomDeploy, [jerryDeploy]);
