import { deployBridgesComplete } from '../../src/bridge';
import * as ethereum from '../../config/mainnets/ethereum';
import * as moonbeam from '../../config/mainnets/moonbeam';
import { BridgeDeploy } from '../../src/bridge/BridgeDeploy';
import { getPathToDeployConfig } from '../../src/verification/readDeployOutput';

// get the path to the latest core system deploy
const path = getPathToDeployConfig('prod');

const ethereumDeploy = new BridgeDeploy(
  ethereum.chain,
  ethereum.bridgeConfig,
  path,
);

const moonbeamDeploy = new BridgeDeploy(
  moonbeam.chain,
  moonbeam.bridgeConfig,
  path,
);

deployBridgesComplete([ethereumDeploy, moonbeamDeploy]);
