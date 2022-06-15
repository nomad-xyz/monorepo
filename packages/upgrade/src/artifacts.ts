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

  async storeOutput(commandName: string): Promise<boolean> {
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
    return true;
  }

  updateConfig(newConfig: config.NomadConfig, dir: string) {
    fs.writeFile(
      `${this.artifactsDir}/upgraded-config.json`,
      JSON.stringify(config),
      function (err) {
        if (err) {
          return console.log(
            `Failed to write upgrade artifact with Error: ${err}`
          );
        }
      }
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
}

interface Artifact {
  executeCallBatchCall: string;
  callBatch: string;
  executeGovernanceActions: string;
}
