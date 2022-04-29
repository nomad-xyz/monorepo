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
  const outputDir = './output';
  try {
    // run the deploy script
    await deployContext.deployAndRelinquish();

    // output the updated config & verification
    outputConfigAndVerification(outputDir, deployContext);

    // output the governance transactions when the deploy succeeds
    // (if the deploy script throws, the callBatch will be
    // re-generated idempotently when the script ultimately succeeds)
    await outputCallBatch(outputDir, deployContext);

    console.log(`DONE!`);
  } catch (e) {
    // if the deploy script fails,
    // output the updated config & verification
    // then re-run the script to pick up where it left off
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

async function outputCallBatch(outputDir: string, deployContext: DeployContext) {
  const governanceBatch = deployContext.callBatch;
  if (!governanceBatch.isEmpty()) {
    // build & write governance batch
    await governanceBatch.build();
    fs.writeFileSync(
        `${outputDir}/governanceTransactions.json`,
        JSON.stringify(governanceBatch, null, 2),
    );
  }
}
