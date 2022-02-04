import * as tom from '../../config/local/tom';
import * as jerry from '../../config/local/jerry';
import { deployHubAndSpoke } from '../../src/core';
import { CoreDeploy } from '../../src/core/CoreDeploy';

const tomDeploy = new CoreDeploy(tom.chain, tom.devConfig);
const jerryDeploy = new CoreDeploy(jerry.chain, jerry.devConfig);

deployHubAndSpoke(tomDeploy, [jerryDeploy]);
