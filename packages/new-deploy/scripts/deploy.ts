import DeployContext from '../src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import fs from "fs";
import * as dotenv from 'dotenv';
import {getConfig,getOverrides} from "./utils";
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
    const governanceTransactions = await deployContext.deployAndRelinquish();
    // output the updated config
    const outputDir = "./output";
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(`${outputDir}/config.json`, JSON.stringify(deployContext.data, null, 4));
    fs.writeFileSync(`${outputDir}/verification.json`, JSON.stringify(Object.fromEntries(deployContext.verification), null, 4));
    fs.writeFileSync(`${outputDir}/governanceTransactions.json`, JSON.stringify(governanceTransactions, null, 4));
    console.log(`DONE!`);
}
