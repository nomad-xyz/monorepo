import { DeployContext } from '../src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import * as dotenv from 'dotenv';
import { getConfig, getOverrides } from './utils';
dotenv.config();

run();

async function run() {
  // define the directory for deploy outputs
  const outputDir = './output';

  // instantiate deploy context
  const DEPLOY_CONFIG: config.NomadConfig = getConfig();
  const deployContext = new DeployContext(DEPLOY_CONFIG, outputDir);

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
  try {
    // run the deploy script
    await deployContext.deployAndRelinquish();

    console.log(`DONE!`);
  } catch (e) {
    // if the deploy script fails,
    // ensure the updated config & verification are outputted
    // then re-run the script to pick up where it left off
    deployContext.output();
    
    throw e;
  }
}
