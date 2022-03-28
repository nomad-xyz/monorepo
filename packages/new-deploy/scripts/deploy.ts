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

/*
* get published config
* modify to add a network
* run the deploy script
* re-publish config
* */
const config = {}; // TODO: get published (or local??) config
const OVERRIDES = {}; // TODO write local overrides config

async function run() {
    const deployContext = new DeployContext(config);
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
