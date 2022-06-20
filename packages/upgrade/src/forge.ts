import * as fs from "node:fs";
import * as config from "@nomad-xyz/configuration";
import * as util from "util";
import * as cp from "child_process";
const asyncExec = util.promisify(cp.exec);

export default class Forge {
  nomadConfig: config.NomadConfig;
  domainName: string;
  command: string;
  workingDir: string;
  etherscanVerify: string;

  constructor(
    config: config.NomadConfig,
    domainName: string,
    workingDir: string
  ) {
    this.nomadConfig = config;
    this.domainName = domainName;
    this.workingDir = workingDir;
    this.etherscanVerify = "";
    this.command = "";
  }

  public async executeCommand(): Promise<{
    stdout: string;
    stderr: string;
  }> {
    // Create directory for upgrade artifacts
    fs.mkdir(
      `${this.workingDir}/${this.domainName}`,
      { recursive: true },
      (err) => {
        if (err) throw err;
      }
    );
    // We add || true so that it never errors, even if the out directory has
    // been already removed
    await asyncExec("rm -rf solscripts/out || true");
    await asyncExec("FOUNDRY_PROFILE=upgrade forge clean");
    // Execute forge script
    const { stdout, stderr } = await asyncExec(this.command);
    return { stdout, stderr };
  }

  public setEtherscanKey(key: string): void {
    this.etherscanVerify = key;
  }

  public scriptCommand(
    domainName: string,
    commandSignature: string,
    args: string,
    pathToFile: string,
    targetContract: string,
    rpcUrl: string,
    privateKey: string,
    resume: boolean,
    broadcast: boolean
  ): void {
    let resumeOrBroadcast;
    if (resume) {
      resumeOrBroadcast = "--resume";
    } else if (broadcast) {
      resumeOrBroadcast = "--broadcast";
    } else {
      resumeOrBroadcast = "";
    }
    if (rpcUrl != "") {
      rpcUrl = `--rpc-url ${rpcUrl}`;
    }

    if (privateKey != "") {
      privateKey = `--private-key ${privateKey}`;
    }

    if (this.etherscanVerify == undefined || rpcUrl.includes("127.0.0.1")) {
      this.etherscanVerify = "";
    }
    if (this.etherscanVerify != "") {
      this.etherscanVerify = `--verify --etherscan-api-key ${this.etherscanVerify}`;
    }

    const pieces = [
      `cd ${this.workingDir}/${domainName}`,
      "&&",
      "FOUNDRY_PROFILE=upgrade forge script",
      `--tc ${targetContract}`,
      `${rpcUrl}`,
      `${resumeOrBroadcast}`,
      `${privateKey}`,
      `--sig '${commandSignature}'`,
      "--slow",
      "--silent",
      "--force",
      `${this.etherscanVerify}`,
      `${pathToFile}`,
      `${args}`,
    ];
    this.command = pieces.join(" ");
  }
}
