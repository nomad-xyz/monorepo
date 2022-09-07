import { NomadConfig } from "@nomad-xyz/configuration";
import { DeployContext } from "./DeployContext";
import fs from 'fs';


(async () => {
    console.log(`Start`);
    const config: NomadConfig = JSON.parse(fs.readFileSync('./config/avail.json', 'utf8'));

    const context = new DeployContext(config);
    console.log(context);
})()