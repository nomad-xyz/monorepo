import { DeployContext } from '../src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import fs from 'fs';
import * as dotenv from 'dotenv';
import { getConfig, getOverrides } from './utils';
dotenv.config();

run();

async function run() {
  // instantiate deploy context
  const DEPLOY_CONFIG: config.NomadConfig = getConfig();
  const deployContext = new DeployContext(DEPLOY_CONFIG);

  // get deploy signer and overrides
  const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error('Add DEPLOYER_PRIVATE_KEY to .env');
  }
  const OVERRIDES = getOverrides();
  // add deploy signer and overrides for each network
  for (const network of deployContext.networks) {
    const provider = deployContext.mustGetProvider(network);
    const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
    const signer = new NonceManager(wallet);
    deployContext.registerSigner(network, signer);
    deployContext.overrides.set(network, OVERRIDES[network]);
  }
  // run the deploy script
  const outputDir = './output';
  try {
    const governanceBatch = await deployContext.deployAndRelinquish();

    outputConfigAndVerification(outputDir, deployContext);

    if (governanceBatch && !governanceBatch.isEmpty()) {
      // build & write governance batch
      await governanceBatch.build();
      fs.writeFileSync(
          `${outputDir}/governanceTransactions.json`,
          JSON.stringify(governanceBatch, null, 2),
      );
    }

    console.log(`DONE!`);
  } catch (e) {
    outputConfigAndVerification(outputDir, deployContext);
    
    throw e;
  }
}

function outputConfigAndVerification(outputDir: string, deployContext: DeployContext) {
  // output the config
  fs.mkdirSync(outputDir, {recursive: true});
  fs.writeFileSync(
      `${outputDir}/config.json`,
      JSON.stringify(deployContext.data, null, 2),
  );
  // if new contracts were deployed,
  const verification = Object.fromEntries(deployContext.verification);
  if (Object.keys(verification).length > 0) {
    // output the verification inputs
    fs.writeFileSync(
        `${outputDir}/verification-${Date.now()}.json`,
        JSON.stringify(verification, null, 2),
    );
  }
}
