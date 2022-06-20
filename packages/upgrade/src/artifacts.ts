import * as fs from "node:fs";
import * as config from "@nomad-xyz/configuration";
import { CallBatchContents } from "@nomad-xyz/sdk-govern";

export default class Artifacts {
  config: config.NomadConfig;
  domainName: string;
  rawForgeOutput: string;
  artifactsDir: string;

  chainId: number;

  constructor(
    rawForgeOutput: string,
    domainName: string,
    config: config.NomadConfig,
    artifactsDir: string,
    chainId: number
  ) {
    this.rawForgeOutput = rawForgeOutput;
    this.domainName = domainName;
    this.config = config;
    this.artifactsDir = artifactsDir;
    this.chainId = chainId;
    config.protocol.networks[domainName].specs.chainId;
  }

  public storeOutput(commandName: string): void {
    console.log(this.rawForgeOutput);
    fs.writeFile(
      `${this.artifactsDir}/${this.domainName}/${commandName}-output.txt`,
      this.rawForgeOutput,
      function (err) {
        if (err) {
          console.log(`Failed to write upgrade artifact with Error: ${err}`);
          return false;
        }
      }
    );
  }

  public storeNewConfig(): void {
    fs.writeFileSync(
      `${this.artifactsDir}/new-config.json`,
      JSON.stringify(this.config)
    );
    console.log(
      `Updated configuration file has been stored at ${this.artifactsDir}/${this.config.environment}-new.json`
    );
  }

  public updateImplementations(): void {
    // get transactions output in forge script artifacts
    const path = `${this.artifactsDir}/${this.domainName}/broadcast/Upgrade.sol/${this.chainId}/deploy-latest.json`;
    const forgeArtifacts = JSON.parse(fs.readFileSync(path).toString());
    const transactions = forgeArtifacts.transactions;
    const domainName = this.domainName;
    for (const tx of transactions) {
      // Contract names in Forge artifacts are in the form of: GovernanceRouter
      // Contract names in the Nomad config are in the form of: governanceRouter
      // Thus, we force the first letter to be lower case
      const contractName: string =
        tx.contractName.charAt(0).toLowerCase() + tx.contractName.slice(1);
      const address: string = tx.contractAddress;
      if (contractName == "home") {
        this.config.core[domainName].home.implementation = address;
      } else if (contractName == "governanceRouter") {
        this.config.core[domainName].governanceRouter.implementation = address;
      } else if (contractName == "bridgeRouter") {
        this.config.bridge[domainName].bridgeRouter.implementation = address;
      } else if (contractName == "tokenRegistry") {
        this.config.bridge[domainName].tokenRegistry.implementation = address;
      } else if (contractName == "bridgeToken") {
        this.config.bridge[domainName].bridgeToken.implementation = address;
      } else if (contractName == "replica") {
        const remotes = Object.keys(this.config.core[domainName].replicas);
        remotes.map((remote) => {
          this.config.core[domainName].replicas[remote].implementation =
            address;
        });
      }
    }
  }

  public static storeCallBatches(dir: string, batch: CallBatchContents): void {
    fs.writeFileSync(
      `${dir}/governanceTransactions.json`,
      JSON.stringify(batch, null, 2)
    );
  }
}
