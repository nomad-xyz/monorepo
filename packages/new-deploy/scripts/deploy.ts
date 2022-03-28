import DeployContext from '../src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import fs from "fs";
import * as dotenv from 'dotenv';
dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error('Add DEPLOYER_PRIVATE_KEY to .env');
}

run();

const DEPLOY_CONFIG: config.NomadConfig = getConfig();
const OVERRIDES = getOverrides();

/*
* FLOW FOR ENGINEER TO ADD A NEW CHAIN:
* 1. load published config to local file (package.json script)
* 2. modify to add a network (manual)
* 3. run the deploy script (package.json script with local path for config)
* 4. re-publish config (package.json script)
*/

/*
* FLOW FOR ENGINEER TO DEPLOY PUBLISHED CONFIG:
* 1. run the deploy script (package.json script with URL for config)
*/

function getConfig(): config.NomadConfig  {
    // TODO:
    // get argument from process.argv
    // try string as filepath
    // try string as URL
    // error
    return {} as any as config.NomadConfig;
}

function getOverrides() {
    // TODO:
    // load from local file (?) based on environment (?)
    return {};
}

async function run() {
    const deployContext = new DeployContext(DEPLOY_CONFIG);
    for (const network of deployContext.networks) {
        const provider = deployContext.mustGetProvider(network);
        const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
        const signer = new NonceManager(wallet);
        deployContext.registerSigner(network, signer);
        deployContext.overrides.set(network, OVERRIDES[network]);
    }
    // run the deploy script
    await deployContext.deployAndRelinquish();
    // output the updated config
    fs.writeFileSync(`./scripts/config.json`, JSON.stringify(deployContext.data, null, 4));
    console.log(`DONE!`);
}
