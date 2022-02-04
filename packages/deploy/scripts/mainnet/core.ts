import { deployComplete } from '../../src/core';
import * as ethereum from '../../config/mainnets/ethereum';
import * as moonbeam from '../../config/mainnets/moonbeam';
import { CoreDeploy } from '../../src/core/CoreDeploy';

const ethereumDeploy = new CoreDeploy(ethereum.chain, ethereum.config);
const moonbeamDeploy = new CoreDeploy(moonbeam.chain, moonbeam.config);

deployComplete([ethereumDeploy, moonbeamDeploy]);
