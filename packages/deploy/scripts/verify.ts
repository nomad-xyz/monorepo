// --chain-id
// --compiler-version
// --num-of-optimizations

// address
// path/to/Contracts.sol:ContractName
// etherscan-key

import { writeFile, readFile } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Verification } from '../src';
import * as dotenv from 'dotenv';
import { NomadContext } from '@nomad-xyz/sdk';
import { NomadConfig } from '@nomad-xyz/configuration';
dotenv.config();

type VerificationOutput = Verification & {
  GUID?: string;
  verifyCommand?: string;
  verified?: boolean;
};

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

/// async sleep function
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const etherscanKey = process.env.ETHERSCAN_KEY;
if (!etherscanKey || etherscanKey.length === 0)
  throw new Error(
    'Missing Etherscan key. Please set the `ETHERSCAN_KEY` variable in your .env file',
  );

/// Extract the etherscan GUID from the `forge verify-contract` stdout
export function extractGuidFromFoundry(res: {
  stdout: string;
  stderr: string;
}): string | undefined {
  // Brittle and lazy parsing. Will break if forge changes its stdout
  if (res.stderr.indexOf('already verified') !== -1) return;
  const bits = res.stdout.split('`');
  if (bits.length < 4)
    throw new Error(`Weird verification output: ${res.stdout}`);
  return bits[3];
}

/// Generate the `forge verify-contract` command for a contract
export function forgeVerifyCommand(verification: VerificationInfo): string {
  const pieces = [
    `FOUNDRY_PROFILE=${verification.profile}`,
    'forge verify-contract',
    `--chain-id ${verification.chainId}`,
    `--compiler-version ${verification.compiler}`,
    `--num-of-optimizations=${verification.optimizations}`,
    `${verification.address}`,
    `${verification.specifier}`,
    `${etherscanKey}`,
  ];

  if (verification.argsFlag) pieces.push(verification.argsFlag);

  return pieces.join(' ');
}

/// Generate the `forge verify-check` for a GUID
export function forgeCheckCommand(verification: VerificationInfo): string {
  const pieces = [
    'forge verify-check',
    `--chain-id ${verification.chainId}`,
    `${verification.GUID}`,
    `${etherscanKey}`,
  ];
  return pieces.join(' ');
}

class VerificationInfo {
  protected _data: VerificationOutput;

  readonly chainId: number;
  readonly compiler: string;
  readonly network: string;
  readonly optimizations: number;

  constructor(
    v: Verification,
    network: string,
    chainId = 1,
    compiler = 'v0.7.6+commit.7338295f',
    optimizations = 999999,
  ) {
    this._data = v;
    this.network = network;
    this.chainId = chainId;
    this.compiler = compiler;
    this.optimizations = optimizations;
  }

  get name(): string {
    return this._data.name;
  }

  get specifier(): string {
    return this._data.specifier;
  }

  get address(): string {
    return this._data.address;
  }

  get constructorArguments(): ReadonlyArray<unknown> | undefined {
    return this._data.constructorArguments;
  }

  get encodedConstructorArguments(): string | undefined {
    return this._data.encodedConstructorArguments;
  }

  get GUID(): string | undefined {
    return this._data.GUID;
  }

  set GUID(GUID: string | undefined) {
    this._data.GUID = GUID;
  }

  get verified(): boolean {
    return this._data.verified ?? false;
  }

  set verified(v: boolean) {
    this._data.verified = v;
  }

  /// Extract the foundry profile from a specifier.
  /// This is brittle code as it relies on the contents of `foundry.toml` not
  /// changing, as well as on our repo layout
  get profile(): string {
    if (this.specifier.indexOf('core') !== -1) return 'core';
    if (this.specifier.indexOf('bridge') !== -1) return 'bridge';
    if (this.specifier.indexOf('router') !== -1) return 'router';
    throw new Error(`bad specifier: ${this.specifier}`);
  }

  get argsFlag(): string | undefined {
    if (!this.encodedConstructorArguments) return;
    return `--constructor-args=${this.encodedConstructorArguments}`;
  }

  get verifyCommand(): string {
    if (this._data.verifyCommand) return this._data.verifyCommand;

    this._data.verifyCommand = forgeVerifyCommand(this);
    return this._data.verifyCommand;
  }

  get checkCommand(): string {
    if (!this.GUID) throw new Error('No GUID. Call `verify` first');
    return forgeCheckCommand(this);
  }

  async verify(): Promise<void> {
    if (this.verified) {
      console.log(this.network, " ", this.name, 'Already Verified');
      return;
    }

    const toRun = this.verifyCommand;
    try {
      console.log(`verifying ${this.network} ${this.name}@${this.address}`);
      const res = await execAsync(toRun);
      this.GUID = extractGuidFromFoundry(res);
      if (!this.GUID) this.verified = true;
    } catch (e: unknown) {
      const err = `${e}`;
      if (err.indexOf('Contract source code already verified') === -1) {
        console.error({ toRun });
        throw e;
      }

      // only "already verified" errors will reach this line
      this.verified = true;
    }
  }

  /// returns the error string
  async check(): Promise<string | undefined> {
    if (!this.GUID) return;
    const toRun = this.checkCommand;
    const { stderr } = await execAsync(toRun);
    if (stderr.indexOf('NOTOK') !== -1) {
      return stderr.split('`')[4];
    } else {
      this.verified = true;
    }
  }

  toJSON(): VerificationOutput {
    return this._data;
  }
}

async function run() {
  console.log();
  const environmentArg = process.argv[2];

  let environment: string | NomadConfig;
  try {
    environment = JSON.parse(
      await readFileAsync(environmentArg, 'utf-8'),
    ) as NomadConfig;
  } catch (_: unknown) {
    environment = environmentArg;
  }

  const jsonPath = process.argv[3];
  const jsonString = await readFileAsync(jsonPath, 'utf8');
  const context = new NomadContext(environment);

  // initial parsing
  const verificationInput: Record<
    string,
    Array<VerificationOutput>
  > = JSON.parse(jsonString);

  // Convert to classes
  const verifications: Record<string, Array<VerificationInfo>> = {};
  Object.entries(verificationInput).forEach(([network, list]) => {
    const chainId = context.mustGetDomain(network).specs.chainId;
    verifications[network] = list.map((v) => new VerificationInfo(v, network, chainId));
  });

  // run verification
  for (const list of Object.values(verifications)) {
    for (const ver of list) {
      await ver.verify();
      // we do this inside the loop so that we always write the `verified` key early
      await writeFileAsync(jsonPath, JSON.stringify(verifications, null, 4));
      await delay(1000);
    }
  }

  // Check that verification worked
  for (const list of Object.values(verifications)) {
    for (const ver of list) {
      const reason = await ver.check();

      if (reason) {
        console.error(
          `verification failed for ${ver.name}@${ver.address}: ${reason}`,
        );
        console.error(ver.verifyCommand);
      }
    }
  }

  await writeFileAsync(jsonPath, JSON.stringify(verificationInput, null, 4));
}

run();
