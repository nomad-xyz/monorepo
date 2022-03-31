import * as config from "@nomad-xyz/configuration";
import fs from "fs";
import ethers from "ethers";

export function getConfig(): config.NomadConfig {
    // TODO:
    // get argument from process.argv
    // try string as filepath
    // try string as URL
    // error
    const args = process.argv.slice(2);
    const path = args[0];
    try {
        // TODO: try bad filepath
        // TODO: try bad file contents
        return JSON.parse(fs.readFileSync(path).toString()) as any as config.NomadConfig;
    } catch (e) {
        console.log("errored....");
        // TODO: try string as URL
        throw e;
    }
}

export function getOverrides(): ethers.Overrides {
    // TODO:
    // get argument from process.argv
    // try string as filepath
    // try string as URL
    // error
    const args = process.argv.slice(2);
    const path = args[1];
    try {
        // TODO: try bad filepath
        // TODO: try bad file contents
        return JSON.parse(fs.readFileSync(path).toString()) as any as ethers.Overrides;
    } catch (e) {
        console.log("errored....");
        // TODO: try string as URL
        throw e;
    }
}

