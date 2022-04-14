import * as config from '@nomad-xyz/configuration';
import {NomadContext} from "@nomad-xyz/sdk";
import {getCallBatch, getConfig} from './utils';
import {CallBatch, CallBatchContents, BatchStatusText, BatchStatus} from "../dist";
import * as dotenv from 'dotenv';
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

    // TODO const OVERRIDES = getOverrides();

    // add deploy signer and overrides for each network
    for (const domain of batch.domains) {
        const provider = context.mustGetProvider(domain);
        const signer = new ethers.Wallet(SIGNER_KEY, provider);
        context.registerSigner(domain, signer);
        // TODO: should you be able to set overrides on the SDK?
        // const name = context.resolveDomainName(domain);
        // context.overrides.set(name, OVERRIDES[name]);
    }

    // for each domain, execute the batch calls
    for (const domain of batch.remoteDomains) {
        const domainName = context.resolveDomainName(domain);
        // check that the batch has been received, but not executed
        const status = await batch.status(domain);
        console.log(`Batch status on ${domainName}: ${BatchStatusText(status)}!`);
        if (status !== BatchStatus.RECEIVED) continue;
        // execute the batch
        console.log(`Executing Batch on ${domainName}...`);
        const tx = await batch.executeDomain(domain);
        const receipt = await tx.wait();
        // print details of execution tx
        console.log(`Executed Batch on ${domainName}!!`);
        console.log(`   Transaction Hash: ${receipt.transactionHash}`);
        console.log(`   Block Explorer: ${CONFIG.protocol.networks[domainName].specs.blockExplorer}`);
    }

    console.log(`DONE!`);
}
