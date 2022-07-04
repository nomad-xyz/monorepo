import { Flags, CliUx } from "@oclif/core";
import Forge from "../../forge";
import Command from "../../base";
import Artifacts from "../../artifacts";
import { CoreContracts, BridgeContracts } from "@nomad-xyz/configuration";

export default class ForkTest extends Command {
  static description =
    "Fork test Upgrading the Nomad Protocol on any number of domains";
  static usage = "forkTest -c <path_to_config> -f <fork_test_rpc> -d <domain>";
  static flags = {
    ...Command.flags,
    forkUrl: Flags.string({
      char: "f",
      required: true,
      description:
        "RPC URL endpoint to be used for the fork test. Must be RPC for --domain",
      default: "http://127.0.0.1:8545",
      env: "FORK_RPC_URL",
    }),
    domainName: Flags.string({
      char: "d",
      required: true,
      description: `Specify the domain to run the fork test. Must match RPC at --forkUrl`,
    }),
  };

  runId!: number;

  async run(): Promise<void> {
    // get the CLI flags
    const { flags } = await this.parse(ForkTest);
    const { forkUrl, domainName } = flags;

    // start the CLI action
    CliUx.ux.action.start(`Starting ForkTest for ${domainName}`);
    console.log(
      "Results and output will be printed after the fork test is complete"
    );

    // load the config
    const core: CoreContracts = this.nomadConfig.core[domainName];
    const bridge: BridgeContracts = this.nomadConfig.bridge[domainName];

    // load the contracts we will test from config
    const domain: string =
      this.nomadConfig.protocol.networks[domainName].domain.toString();
    const replicaName: string = Object.keys(
      this.nomadConfig.core[domainName].replicas
    )[0];
    const recoveryTimelock =
      this.nomadConfig.protocol.networks[domainName].configuration.governance
        .recoveryTimelock;

    // Set runId
    this.runId = Date.now();

    // Set env variables required by Fork test and Upgrade
    process.env.NOMAD_DOMAIN_NAME = domainName;
    process.env.NOMAD_DOMAIN = domain;
    process.env.NOMAD_REPLICA_PROXY = core.replicas[replicaName].proxy;
    process.env.NOMAD_GOV_ROUTER_PROXY = core.governanceRouter.proxy;
    process.env.NOMAD_BEACON_CONTROLLER = core.upgradeBeaconController;

    // Upgrade Beacons
    process.env.NOMAD_HOME_BEACON = core.home.beacon;
    process.env.NOMAD_REPLICA_BEACON = core.replicas[replicaName].beacon;
    process.env.NOMAD_GOVERNANCE_ROUTER_BEACON = core.governanceRouter.beacon;
    process.env.NOMAD_BRIDGE_ROUTER_BEACON = bridge.bridgeRouter.beacon;
    process.env.NOMAD_TOKEN_REGISTRY_BEACON = bridge.tokenRegistry.beacon;
    process.env.NOMAD_BRIDGE_TOKEN_BEACON = bridge.bridgeToken.beacon;
    process.env.NOMAD_XAPP_CONNECTION_MANAGER =
      this.nomadConfig.core[domainName].xAppConnectionManager;
    process.env.NOMAD_RECOVERY_TIMELOCK = recoveryTimelock.toString();

    process.env.NOMAD_UPDATER_MANAGER = core.updaterManager;

    // run the forge command
    const forge = new Forge(this.nomadConfig, domainName, this.workingDir);
    forge.command = `FOUNDRY_PROFILE=upgrade forge test --ffi --fork-url ${forkUrl} -vvvv`;
    try {
      const { stdout, stderr } = await forge.executeCommand();
      if (stdout) {
        this.log(`${stdout}`);
      }
      if (stderr) {
        this.warn(`${stderr}`);
      }

      // If there is a test, anvil's chainId = 31337
      // Fork tests are always local, thus we hardcode the chainId
      const chainId = 31337;

      // print the artifacts from forge command
      const artifacts = new Artifacts(
        `${stdout}`,
        domainName,
        this.nomadConfig,
        this.workingDir,
        chainId,
        this.runId
      );
      artifacts.storeOutput("upgrade-forkTest");
    } catch (err) {
      this.warn(`${err}`);
      throw err;
    }
    // finish
    CliUx.ux.action.stop("Fork Test completed");
  }
}