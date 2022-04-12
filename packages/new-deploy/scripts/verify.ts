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
dotenv.config();

type VerificationOutput = Verification & {
  GUID?: string;
  verifyCommand: string;
  verified?: boolean;
};

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const etherscanKey = process.env.ETHERSCAN_KEY;

/// async sleep function
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/// Get the args, if any
function getArgs(verification: Verification): string {
  const { encodedConstructorArguments } = verification;
  if (!encodedConstructorArguments) return '';
  return `--constructor-args=${encodedConstructorArguments}`;
}

/// Extract the etherscan GUID from the `forge verify-contract` stdout
export function extractGuidFromFoundry(res: {
  stdout: string;
  stderr: string;
}): string | undefined {
  if (res.stderr.indexOf('already verified') !== -1) return;

  const bits = res.stdout.split('`');
  return bits[3];
}

/// Extract the foundry profile from a specifier.
/// This is brittle code as it relies on the contents of `foundry.toml` not
/// changing, as well as on our repo layout
function getProfile(verification: Verification): string {
  if (verification.specifier.indexOf('core') !== -1) return 'core';
  if (verification.specifier.indexOf('bridge') !== -1) return 'bridge';
  if (verification.specifier.indexOf('router') !== -1) return 'router';
  throw new Error(`bad specifier: ${verification.specifier}`);
}

/// Generate the `forge verify-contract` command for a contract
export function forgeVerifyCommand(
  verification: Verification,
  chainId = 1,
  compiler = 'v0.7.6+commit.7338295f',
  optimizations?: number,
): string {
  const pieces = [
    `FOUNDRY_PROFILE=${getProfile(verification)}`,
    'forge verify-contract',
    `--chain-id ${chainId}`,
    `--compiler-version ${compiler}`,
    `--num-of-optimizations=${optimizations}`,
    `${verification.address}`,
    `${verification.specifier}`,
    `${etherscanKey}`,
    getArgs(verification),
  ];

  return pieces.join(' ');
}

/// Generate the `forge verify-check` for a GUID
export function forgeCheckCommand(GUID: string, chainId = 1): string {
  const pieces = [
    'forge verify-check',
    `--chain-id ${chainId}`,
    `${GUID}`,
    `${etherscanKey}`,
  ];
  return pieces.join(' ');
}

/// Run `forge verify-contract`
export async function forgeVerify(
  verification: VerificationOutput,
  chainId?: number,
  compiler?: string,
  optimizations?: number,
): Promise<string | undefined> {
  const toRun = forgeVerifyCommand(
    verification,
    chainId,
    compiler,
    optimizations,
  );
  verification.verifyCommand = toRun;
  try {
    const res = await execAsync(toRun);
    return extractGuidFromFoundry(res);
  } catch (e: unknown) {
    const err = `${e}`;
    console.error(toRun);
    if (err.indexOf('Contract source code already verified') === -1) throw e;

    // only "already verified" errors will reach this line
    verification.verified = true;
  }
}

export async function forgeCheck(
  GUID: string | undefined,
  chainId = 1,
): Promise<string | undefined> {
  if (!GUID) return;
  const toRun = forgeCheckCommand(GUID, chainId);
  const { stderr } = await execAsync(toRun);
  if (stderr.indexOf('NOTOK') !== -1) {
    return stderr.split('`')[4];
  }
}

async function run() {
  console.log();
  const environment = process.argv[2];
  const jsonPath = process.argv[3];
  const jsonString = await readFileAsync(jsonPath, 'utf8');
  const verificationMap: Record<
    string,
    ReadonlyArray<VerificationOutput>
  > = JSON.parse(jsonString);

  const context = new NomadContext(environment);

  for (const [network, verifications] of Object.entries(verificationMap)) {
    const chainId = context.mustGetDomain(network).specs.chainId;
    // run verification
    for (const verification of verifications) {
      if (verification.verified) continue;

      const GUID = await forgeVerify(
        verification,
        chainId,
        'v0.7.6+commit.7338295f',
        999999,
      );
      verification.GUID = GUID;
      console.log(verification.name, GUID ?? 'Already Verified');
      await delay(1000);
    }
  }

  await writeFileAsync(jsonPath, JSON.stringify(verificationMap, null, 4));

  for (const [network, verifications] of Object.entries(verificationMap)) {
    const chainId = context.mustGetDomain(network).specs.chainId;
    // Check that verification worked
    for (const verification of verifications) {
      const reason = await forgeCheck(verification.GUID, chainId);
      if (reason) {
        console.error(
          `verification failed for ${verification.address}: ${reason}`,
        );
        console.error(
          forgeVerifyCommand(
            verification,
            chainId,
            'v0.7.6+commit.7338295f',
            999999,
          ),
        );
      } else {
        verification.verified = true;
      }
    }
  }

  await writeFileAsync(jsonPath, JSON.stringify(verificationMap, null, 4));
}

run();
