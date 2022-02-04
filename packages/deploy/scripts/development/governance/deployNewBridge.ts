import * as rinkeby from '../../../config/testnets/rinkeby';
import * as milkomedatestnet from '../../../config/testnets/milkomedatestnet';
import {
  BridgeDeploy,
  ExistingBridgeDeploy,
} from '../../../src/bridge/BridgeDeploy';
import { deployNewChainBridge } from '../../../src/bridge';
import { getPathToDeployConfig } from '../../../src/verification/readDeployOutput';

const path = getPathToDeployConfig('dev');

// Instantiate existing governor deploys on Rinkeby
const rinkebyBridgeDeploy = new ExistingBridgeDeploy(
  rinkeby.chain,
  rinkeby.bridgeConfig,
  path,
);

// make new milkomedatestnet bridge Deploy
const milkomedatestnetBridgeDeploy = new BridgeDeploy(
  milkomedatestnet.chain,
  milkomedatestnet.bridgeConfig,
  path,
);

// Deploy Kovan bridge with Rinkeby hub
deployNewChainBridge(milkomedatestnetBridgeDeploy, rinkebyBridgeDeploy);
