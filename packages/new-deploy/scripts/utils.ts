import * as config from "@nomad-xyz/configuration";
import fs from "fs";
import ethers from "ethers";

export function getConfig(): config.NomadConfig {
    // first, get config location from process.argv
    const args = process.argv.slice(2);
    const path = args[0];
    try {
        // try loading as a local filepath
        return JSON.parse(fs.readFileSync(path).toString()) as any as config.NomadConfig;
    } catch (e) {
        // try {
            // TODO: try loading as a URL, catch failures
            throw e;
        // } catch (e) {
        //     throw e;
        // }
    }
}

interface OverridesMap {
    [key: string]: ethers.Overrides;
}

export function getOverrides(): OverridesMap {
    // first, get overrides location from process.argv
    const args = process.argv.slice(2);
    const path = args[1];
    try {
        // try loading as a local filepath
        return JSON.parse(fs.readFileSync(path).toString()) as any as OverridesMap;
    } catch (e) {
        // try {
            // TODO: try loading as a URL, catch failures
            throw e;
        // } catch (e) {
        //     throw e;
        // }
    }

}

