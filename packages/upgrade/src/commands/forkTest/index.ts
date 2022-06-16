import Forge from "../../Forge";
import Command from "../../Base";
import { Flags, CliUx } from "@oclif/core";
import Upgrade from "../Upgrade";
import Artifacts from "../../Artifacts";
export default class ForkTest extends Command {
  static flags = {
    ...Command.flags,
    forkUrl: Flags.string({
      char: "f",
      description: "RPC URL endpoint to be used for the fork test",
      default: "http://127.0.0.1:8545",
      required: true,
      env: "RPC_URL",
    }),
  };

  async run() {
    const { flags } = await this.parse(ForkTest);
    if (this.domains.length != 1) {
      throw new Error("Please execute the Fork Tests on a single domain");
    }

    CliUx.ux.action.start(`Starting ForkTest for ${this.domains[0]}`);
    console.log("Starting Fork test...");
    console.log(
      "Results and output will be printed after the fork test is complete"
    );
    // Get first replica beacon.
    // All replicas in every domain, share the same beacon, as they share the same implementation
    // but have different proxies, because they have different storage.
    const config = this.nomadConfig;
    const domainName = this.domains[0];
    const rpc = flags.forkUrl;
    const replicaProxy =
      config.core[domainName].replicas[
        Object.keys(config.core[domainName].replicas)[0]
      ].proxy;

    const governanceRouterProxy =
      config.core[domainName].governanceRouter.proxy;

    // Set env variables required by Fork test and Upgrade
    process.env.NOMAD_REPLICA_PROXY = replicaProxy;
    process.env.NOMAD_GOV_ROUTER = governanceRouterProxy;
    process.env.NOMAD_DOMAIN_NAME = domainName;
    process.env.NOMAD_DOMAIN =
      config.protocol.networks[domainName].domain.toString();
    Upgrade.setUpgradeEnv(domainName, config);

    const forge = new Forge(config, domainName, this.workingDir);
    forge.command = `FOUNDRY_PROFILE=upgrade forge test --ffi --silent --fork-url ${rpc} -vvvv`;
    try {
      const { stdout, stderr } = await forge.executeCommand("forkTest");
      if (stdout) {
        this.log(`${stdout}`);
      }

      if (stderr) {
        this.warn(`${stderr}`);
      }

      const artifacts = new Artifacts(
        `${stdout}`,
        domainName,
        config,
        this.workingDir
      );
      artifacts.storeOutput("upgrade");
      artifacts.extractArtifacts();
      CliUx.ux.action.stop("Fork Test completed");
      await artifacts.updateArtifacts();
    } catch (error) {
      this.error(`Forge execution encountered an error:${error}`);
    }
  }
}
