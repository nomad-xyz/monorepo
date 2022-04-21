import * as config from '@nomad-xyz/configuration';
import {NomadContext} from "@nomad-xyz/sdk";
import {getCallBatch, getConfig} from './utils';
import {CallBatch, CallBatchContents} from "../dist";
import * as dotenv from 'dotenv';
import {equalIds} from "@nomad-xyz/multi-provider/dist/utils";
import * as ethers from "ethers";
dotenv.config();

run();

async function run() {
    // instantiate CallBatch from config & batch contents
    const CONFIG: config.NomadConfig = getConfig();
    const context = new NomadContext(CONFIG);
    const BATCH_CONTENTS: CallBatchContents = getCallBatch();
    const batch = await CallBatch.fromJSON(context, BATCH_CONTENTS);

    // get transaction signing key
    const SIGNER_KEY = process.env.SIGNER_KEY;
    if (!SIGNER_KEY) {
        throw new Error('Add SIGNER_KEY to .env');
    }

    // setup provider & signer
    const domain = context.governor.domain;
    const provider = context.mustGetProvider(domain);
    const signer = new ethers.Wallet(SIGNER_KEY, provider);
    context.registerSigner(domain, signer);

    // get block explorer
    const blockExplorer = CONFIG.protocol.networks[context.resolveDomainName(domain)].specs.blockExplorer;

    // get governor address
    const governorCore = await context.governorCore();
    const governor = await governorCore.governanceRouter.governor();

    // if provided signer is the governor, execute the batch directly
    // otherwise, send the built transaction to the governor gnosis safe
    if (equalIds(governor, signer.address)) {
        console.log("Sending governance tx...");
        const txResponse = await batch.execute();
        const receipt = await txResponse.wait();
        console.log("Governance tx mined!!");
        console.log("   Transaction Hash: ", receipt.transactionHash);
        console.log("   Block Explorer: ", blockExplorer);
    } else {
        // TODO: send to gnosis safe directly
    }

    console.log("DONE!");
}
