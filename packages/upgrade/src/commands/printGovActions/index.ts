import * as config from "@nomad-xyz/configuration";
import * as fs from "node:fs";
import * as dotenv from "dotenv";
import Forge from "../../Forge";
import Command from "../../Base";
import { Flags, CliUx } from "@oclif/core";
import Artifacts from "../../Artifacts";
export default class PrintGovActions extends Command {
  nomadConfig: config.NomadConfig;
  newNomadConfig: config.NomadConfig;

  static usage = "printGovActions -c <path_to_config> -d ethereum";
  async run() {
    // Hardcoded, should change
    const { flags } = await this.parse(PrintGovActions);
    const domains = flags.domains;
    if (domains.length != 1) {
      throw new Error(
        `You can execute govActions only the Governor Chain, thus you need to pass exactly a single domain. You passed: ${domains}}`
      );
    }
    const govChain = domains[0];
    CliUx.ux.action.start(`Printing GovChainActions for ${domains[0]}`);
    const config = this.nomadConfig;
    CliUx.ux.action.stop("GovChainActions printed!");
  }
}
