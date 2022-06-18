import * as fs from "node:fs";
import * as config from "@nomad-xyz/configuration";
import { CallBatch } from "@nomad-xyz/sdk-govern";

export default class Artifacts {
  config: config.NomadConfig;
  domainName: string;
  rawForgeOutput: string;
  artifactsDir: string;

  constructor(
    rawForgeOutput: string,
    domainName: string,
    config: config.NomadConfig,
    artifactsDir: string
  ) {
    this.rawForgeOutput = rawForgeOutput;
    this.domainName = domainName;
    this.config = config;
    this.artifactsDir = artifactsDir;
  }

  public storeOutput(commandName: string) {
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

  public storeNewConfig() {
    fs.writeFile(
      `${this.artifactsDir}/new-config.json`,
      JSON.stringify(this.config),
      function (err) {
        if (err) {
          return console.log(
            `Failed to write upgrade artifact with Error: ${err}`
          );
        }
      }
    );
    console.log(
      `Updated configuration file has been stored at ${this.artifactsDir}/new-config.json}`
    );
  }

  public updateImplementations() {
    // get transactions output in forge script artifacts
    const path = `${this.artifactsDir}/${this.domainName}/broadcast/Upgrade.sol/31337/deploy-latest.json`;
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
      if (contractName != "replica") {
        // The contract will either belong to 'core' or 'bridge' objects
        // of the config file
        try {
          this.config.core[domainName][contractName].implementation = address;
        } catch {
          this.config.bridge[domainName][contractName].implementation = address;
        }
      } else {
        for (const network of this.config.networks) {
          // The domain does not have deployed replicas of itself
          // They live only on different domains
          if (network == domainName) {
            continue;
          }
          this.config.core[domainName].replicas[network].implementation =
            address.slice(2);
        }
      }
    }
  }

  public static storeCallBatches(dir: string, batch: CallBatch) {
    fs.writeFileSync(
      `${dir}/governanceTransactions.json`,
      JSON.stringify(batch, null, 2)
    );
  }
}
