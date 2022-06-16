import Forge from "../../Forge";
import Command from "../../Base";
import { Flags, CliUx } from "@oclif/core";
import * as fs from "node:fs";
import Artifacts from "../../Artifacts";
export default class ExecuteCallBatch extends Command {
  static flags = {
    ...Command.flags,
    privateKey: Flags.string({
      char: "k",
      description:
        "Private key to be used for issuing the upgrade transactions",
      required: true,
      env: "PRIVATE_KEY",
    }),
  };

  static usage =
    "executeCallBatch -c <path_to_config> -k <private_key> -d ethereum evmos";

  static description =
    "Ececute Governance messages that have arrived to a domain via 'executeCallBatch()'";

  async run() {
    const config = this.nomadConfig;
    const { flags } = await this.parse(ExecuteCallBatch);
    const privateKey = flags.privateKey;
    for (const domainName of this.domains) {
      CliUx.ux.action.start(`Executing callBatch for ${this.domains[0]}`);
      const rpc = config.rpcs[domainName][0];
      const path = `./upgrade-artifacts/${domainName}/artifacts.json`;
      // try loading as a local filepath
      const artifacts = JSON.parse(fs.readFileSync(path).toString());
      if (artifacts.executeCallBatch.length === 0) {
        throw new Error(
          `batchCallData artifact is empty for domain ${domainName}. Run the upgrade script or manually create an artifacts.json file with the required fields`
        );
      }
      const batch = artifacts.batch;
      const govRouterAddress = config.core[domainName].governanceRouter.proxy;
    }
  }
}
