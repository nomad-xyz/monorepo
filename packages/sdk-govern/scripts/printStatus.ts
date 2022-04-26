import * as config from '@nomad-xyz/configuration';
import {NomadContext} from "@nomad-xyz/sdk";
import {getCallBatch, getConfig} from './utils';
import {BatchStatus, CallBatch, CallBatchContents} from "../dist";
import * as dotenv from 'dotenv';

dotenv.config();
run();

async function run() {
    // instantiate CallBatch from config & batch contents
    const CONFIG: config.NomadConfig = getConfig();
    const context = new NomadContext(CONFIG);
    const BATCH_CONTENTS: CallBatchContents = getCallBatch();
    const batch = await CallBatch.fromJSON(context, BATCH_CONTENTS);

    // for each domain, check if batch has been received
    await Promise.all(
        batch.remoteDomains.map(async (domain: number) => {
            const domainName = context.resolveDomainName(domain);
            const status = await batch.status(domain);
            console.log(`Batch status on ${domainName}: ${BatchStatus[status]}!`);
        }),
    );
}
