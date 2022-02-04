import { deployHubAndSpoke } from '../../src/core';
import * as rinkeby from '../../config/testnets/rinkeby';
import * as moonbasealpha from '../../config/testnets/moonbasealpha';
import { CoreDeploy } from '../../src/core/CoreDeploy';

const rinkebyConfig = rinkeby.stagingConfig;
const rinkebyDeploy = new CoreDeploy(rinkeby.chain, rinkebyConfig);

const moonbaseAlphaConfig = moonbasealpha.stagingConfig;
const moonbaseAlphaDeploy = new CoreDeploy(
  moonbasealpha.chain,
  moonbaseAlphaConfig,
);

deployHubAndSpoke(rinkebyDeploy, [moonbaseAlphaDeploy]);
