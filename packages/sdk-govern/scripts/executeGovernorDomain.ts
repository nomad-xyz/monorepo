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

    // if governor is a contract (not a signer),
    // inform the caller
    // TODO: submit transaction directly via gnosis safe API instead of throwing
    const governorCode = await provider.getCode(governor);
    if (governorCode != "0x") {
        throw new Error(`Governor in ${CONFIG.environment} is a contract - likely a Gnosis multisig \nSubmit governance transactions on https://gnosis-safe.io/ \nAddress: ${governor} \nChain: ${context.resolveDomainName(domain)}`);
    }

    // if the signer provided is not the governor,
    // inform the caller
    if (!equalIds(governor, signer.address)) {
        throw new Error(`Signer is not the Governor key. Update SIGNER_KEY in .env\nExpected Governor: ${governor}\nActual Provided: ${signer.address}`);
    }

    // if the governor is an EOA
    // that matches the provided signer
    // execute the transactions
    console.log("Sending governance tx...");
    const txResponse = await batch.execute();
    const receipt = await txResponse.wait();
    console.log("Governance tx mined!!");
    console.log("   Transaction Hash: ", receipt.transactionHash);
    console.log("   Block Explorer: ", blockExplorer);

    console.log("DONE!");
}
