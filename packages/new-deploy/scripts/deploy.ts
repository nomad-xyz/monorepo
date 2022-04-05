import DeployContext from '../src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import fs from "fs";
import * as dotenv from 'dotenv';
import {getConfig,getOverrides} from "./utils";
import bunyan from 'bunyan';
// const  = require('bunyan');
dotenv.config();

run();

async function run() {

    const logger = bunyan.createLogger({name: "myapp", level: 'debug'});
    logger.info(`started!`);
    // instantiate deploy context
    const DEPLOY_CONFIG: config.NomadConfig = getConfig();
    const deployContext = new DeployContext(DEPLOY_CONFIG, logger);

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
    fs.writeFileSync(`./scripts/config.json`, JSON.stringify(deployContext.data, null, 4));
    fs.writeFileSync(`./scripts/verification.json`, JSON.stringify(deployContext.verification, null, 4));
    fs.writeFileSync(`./scripts/governanceTransactions.json`, JSON.stringify(governanceTransactions, null, 4));
    logger.info(`DONE!`);
}
