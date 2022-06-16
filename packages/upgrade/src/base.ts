// src/base.ts
import { Command, Flags } from "@oclif/core";
import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as config from "@nomad-xyz/configuration";
export default abstract class Nomgrade extends Command {
  static flags = {
    loglevel: Flags.string({ options: ["error", "warn", "info", "debug"] }),
    config: Flags.string({
      required: true,
      char: "c",
      description:
        "Path to the config file that will be usedof the Nomad Protocol",
    }),
    domains: Flags.string({
      char: "d",
      multiple: true,
      exclusive: ["all"],
      description: `
Run the command on specific domain(s). To pass multiple domains, simply pass them like this: -d ethereum evmos avalanche.
Due to a parsing bug, this flag must be passed at the end of the command. e.g 'nomgrade upgrade -d ethereum'`,
    }),
    all: Flags.boolean({
      char: "a",
      description: "Run on all the domains that exist in the config file",
      exclusive: ["domains"],
    }),
    help: Flags.help({
      description: "Show help for the command. Use --help, not -h",
    }),
    version: Flags.version(),
    workingDir: Flags.string({
      required: false,
      char: "w",
      description: "Directory for outputs and artifacts",
      default: "data",
    }),
  };

  nomadConfig: config.NomadConfig;

  domains: string[];
  all: boolean;
  newNomadConfig: config.NomadConfig;

  workingDir: string;

  async init() {
    dotenv.config();
    // do some initialization
    const { flags } = (await this.parse(this.constructor as any)) as any;
    if (!flags.domains && !flags.all) {
      throw new Error(
        "No domains have been chosen. Either chose some domains with '-d <domain> <domain2>' or all with '-a'"
      );
    }
    this.nomadConfig = this.getConfigFromPath(flags.config);
    this.domains = flags.domains;
    this.workingDir = flags.workingDir;
    this.all = flags.all;
  }

  async catch(err: any) {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err);
  }

  getConfigFromPath(path: string) {
    try {
      // try loading as a local filepath
      return JSON.parse(fs.readFileSync(path).toString());
    } catch (error) {
      throw error;
    }
  }

  announce(what: string): void {
    console.log();
    console.log("===================================");
    console.log(what);
    console.log("===================================");
    console.log();
  }
}
