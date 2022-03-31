import DeployContext from '../src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import fs from "fs";
import * as dotenv from 'dotenv';
import {getConfig} from "./utils";
dotenv.config();

run();

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

async function run() {
    // instantiate deploy context
    const DEPLOY_CONFIG: config.NomadConfig = getConfig();
    const deployContext = new DeployContext(DEPLOY_CONFIG);

    // get deploy signer and overrides
    const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
    if (!DEPLOYER_PRIVATE_KEY) {
        throw new Error('Add DEPLOYER_PRIVATE_KEY to .env');
    }
    // TODO const OVERRIDES = getOverrides();
    // add deploy signer and overrides for each network
    for (const network of deployContext.networks) {
        const provider = deployContext.mustGetProvider(network);
        const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
        const signer = new NonceManager(wallet);
        deployContext.registerSigner(network, signer);
        // TODO deployContext.overrides.set(network, OVERRIDES[network]);
    }

    // TODO: refactor to overrides config
    deployContext.overrides.set(`rinkeby`, {
        maxFeePerGas: '20000000000',
        maxPriorityFeePerGas: '2000000000',
    });
    deployContext.overrides.set(`kovan`, {
        gasPrice: '10000000000',
    });
    deployContext.overrides.set(`moonbasealpha`, {
        maxFeePerGas: '20000000000',
        maxPriorityFeePerGas: '2000000000',
    });
    deployContext.overrides.set(`milkomedaC1testnet`, {
    });
    
    // run the deploy script
    const governanceTransactions = await deployContext.deployAndRelinquish();
    // output the updated config
    fs.writeFileSync(`./scripts/config.json`, JSON.stringify(deployContext.data, null, 4));
    fs.writeFileSync(`./scripts/verification.json`, JSON.stringify(deployContext.verification, null, 4));
    fs.writeFileSync(`./scripts/governanceTransactions.json`, JSON.stringify(governanceTransactions, null, 4));
    console.log(`DONE!`);
}
