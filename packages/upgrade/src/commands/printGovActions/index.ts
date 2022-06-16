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
    const rpc = config.rpcs[govChain][0];
    const remoteBatches: string[] = [];
    const remoteDomains: number[] = [];
    let localBatch = "";
    for (const domainName of config.networks) {
      try {
        const path = `${this.workingDir}/${domainName}/artifacts.json`;
        const artifacts = JSON.parse(fs.readFileSync(path).toString());
        if (artifacts.callBatch.length === 0) {
          throw new Error(
            `batchCallData artifact is empty for domain ${domainName}. Run the upgrade script or manually create an artifacts.json file with the required fields`
          );
        }

        if (domainName != govChain) {
          remoteBatches.push(artifacts.callBatch);
          remoteDomains.push(config.protocol.networks[domainName].domain);
        } else {
          localBatch = artifacts.callBatch;
        }
      } catch (error) {
        throw error;
      }
    }

    // Forge can read arrays, but they need to consist of the values, seperated by the delimeter
    // without any quotes, spaces or brackets.
    process.env.NOMAD_REMOTE_CALL_BATCHES = JSON.stringify(remoteBatches)
      .replace(/[\])}[{(]/g, "")
      .replace(/["']+/g, "")
      .replace(/["']+/g, "");
    process.env.NOMAD_REMOTE_DOMAINS = JSON.stringify(remoteDomains)
      .replace(/[\])}[{(]/g, "")
      .replace(/["']+/g, "")
      .replace(/["']+/g, "");
    process.env.NOMAD_LOCAL_CALL_BATCH = localBatch;
    process.env.NOMAD_GOV_ROUTER_PROXY =
      config.core[govChain].governanceRouter.proxy;
    const forge = new Forge(config, govChain, this.workingDir);
    forge.scriptCommand(
      govChain,
      "printGovernanceActions()",
      "",
      "../../solscripts/Upgrade.sol",
      "UpgradeActions",
      "",
      "",
      false,
      false
    );
    const { stdout, stderr } = await forge.executeCommand("executeGovActions");
    if (stderr) {
      this.warn(`${stderr}`);
    }
    if (stdout) {
      this.log(`${stdout}`);
    }

    const artifacts = new Artifacts(
      `${stdout}`,
      govChain,
      config,
      this.workingDir
    );
    artifacts.storeOutput("upgrade");
    artifacts.extractArtifacts();
    CliUx.ux.action.start("GovChainActions printed!");
    await artifacts.updateArtifacts();
  }
}
