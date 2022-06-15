import * as fs from "node:fs";
import * as config from "@nomad-xyz/configuration";

export default class Artifacts {
  domainName: string;

  config: config.NomadConfig;

  newConfig: config.NomadConfig;

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
    if (this.newConfig == this.config) {
      console.warn("The config hasn't been updated, no need to update");
      return;
    }
    fs.writeFile(
      `${this.artifactsDir}/new-config.json`,
      JSON.stringify(this.newConfig),
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
      executeCallBatchCall: "",
      callBatch: "",
      executeGovernanceActions: "",
    };
    for (const [index, value] of lines.entries()) {
      // Artifact used by executeCallbatch()
      // Execute the batched calls that have been sent to a Governance Router
      if (value.includes("executeCallBatch-artifact")) {
        artifact.executeCallBatchCall = lines[index + 1].replace(/\s/g, "");
        // Artifact used by executeGovernanceActions()
        // It's abi.encoded calldata to be sent from the Governor Chain
        // to the remote chains via a governance message
      } else if (value.includes("callBatch-artifact")) {
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
  public extractImplementations() {
    const lines = this.rawForgeOutput.split("\n");
    this.newConfig = this.config;
    const config = this.newConfig;
    const core = config.core;
    const bridge = config.bridge;
    const domainName = this.domainName;
    for (const [index, value] of lines.entries()) {
      if (value.includes("implementation address")) {
        const contractName: string = value
          .replace(/\s/g, "")
          .split("implementation")[0];
        const address: string = lines[index + 1].replace(/\s/g, "");
        if (contractName != "replica") {
          // The contract will either belong to 'core' or 'bridge' objects
          // of the config file
          try {
            const contract: config.Proxy = core[domainName][
              contractName as keyof config.EvmCoreContracts
            ] as config.Proxy;
            contract.implementation = address;
          } catch {
            const contract: config.Proxy = bridge[domainName][
              contractName as keyof config.EvmBridgeContracts
            ] as config.Proxy;
            contract.implementation = address;
          }
        } else {
          for (const network of config.networks) {
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

    // Move back the changes
    config.core = core;
    config.bridge = bridge;
    this.newConfig = config;
  }
}

interface Artifact {
  executeCallBatchCall: string;
  callBatch: string;
  executeGovernanceActions: string;
}
