import * as fs from "node:fs";
import * as config from "@nomad-xyz/configuration";

export default class Artifacts {
  domainName: string;

  config: config.NomadConfig;

  rawForgeOutput: string;

  artifactsDir: string;

  artifact: Artifact;

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

  public updateConfig() {
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

  updateArtifacts() {
    // If upgrade or printGovActions, then extract Artifacts
    // They are different artifacts that live in the same JSON file
    // Extract specific artifacts from raw output and store them in a JSON file
    const path = `${this.artifactsDir}/${this.domainName}/artifacts.json`;
    let newArtifacts = this.extractArtifacts();
    try {
      const existing: Artifact = JSON.parse(fs.readFileSync(path).toString());
      console.log("Found existing artifacts, appending..");
      for (const key of Object.keys(existing)) {
        // From the newArtifacts, keep only the non-empty
        // fields
        if (newArtifacts[key as keyof Artifact] != "") {
          existing[key as keyof Artifact] = newArtifacts[key as keyof Artifact];
        }
      }

      newArtifacts = existing;
    } catch {
      console.log("No artifacts.json file found. Creating new..");
    }

    fs.writeFileSync(path, JSON.stringify(newArtifacts));
    console.log(`Artifacts were written to ${path}`);
  }

  extractArtifacts(): Artifact {
    const lines = this.rawForgeOutput.split("\n");
    const artifact: Artifact = {
      callBatch: "",
      executeGovernanceActions: "",
    };
    for (const [index, value] of lines.entries()) {
      // Artifact used by executeCallbatch()
      // Execute the batched calls that have been sent to a Governance Router
      if (value.includes("callBatch-artifact")) {
        artifact.callBatch = lines[index + 1].replace(/\s/g, "");
        // Artifact used by executeGovernanceActions()
        // It's a function call encoded with signature and arguments
        // ready to be sent via Nomad Governance to the Governor's chain Governance Router
      } else if (value.includes("executeGovernanceActions-artifact")) {
        artifact.executeGovernanceActions = lines[index + 1].replace(/\s/g, "");
      }
    }

    this.artifact = artifact;
    return artifact;
  }

  public updateImplementations() {
    const path = `${this.artifactsDir}/${this.domainName}/broadcast/Upgrade.sol/31337/upgrade-latest.json`;
    const forgeArtifacts = JSON.parse(fs.readFileSync(path).toString());
    const transactions = forgeArtifacts.transactions;
    const domainName = this.domainName;
    const core = this.config.core;
    const bridge = this.config.bridge;
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
          core[domainName][contractName].implementation = address;
        } catch {
          bridge[domainName][contractName].implementation = address;
        }
      } else {
        for (const network of this.config.networks) {
          // The domain does not have deployed replicas of itself
          // They live only on different domains
          if (network == domainName) {
            continue;
          }
          core[domainName].replicas[network].implementation = address;
        }
      }
    }
  }
}

interface Artifact {
  callBatch: string;
  executeGovernanceActions: string;
}
