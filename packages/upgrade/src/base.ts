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
        "Path to the config file that will be used of the Nomad Protocol",
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

  nomadConfig: config.NomadConfig = config.blankConfig();
  workingDir = "";

  async init(): Promise<void> {
    dotenv.config();
    // do some initialization
    // Hack to parse flags in an abstract class
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const { flags } = (await this.parse(this.constructor as any)) as any;
    this.nomadConfig = this.getConfigFromPath(flags.config);
    this.workingDir = flags.workingDir;
  }

  async catch(err: Error): Promise<Error> {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err);
  }

  getConfigFromPath(path: string): config.NomadConfig {
    // try loading as a local filepath
    return JSON.parse(fs.readFileSync(path).toString());
  }

  announce(what: string): void {
    console.log();
    console.log("===================================");
    console.log(what);
    console.log("===================================");
    console.log();
  }
}