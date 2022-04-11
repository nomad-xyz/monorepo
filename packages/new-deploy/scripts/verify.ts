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

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const etherscanKey = process.env.ETHERSCAN_KEY;

/// async sleep function
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArgs(verification: Verification): string {
  const encodeConstructorArgs = verification;
  if (!encodeConstructorArgs) return '';
  return `--constructor-args=${encodeConstructorArgs}`;
}

/// Extract the etherscan GUID from the `forge verify-contract` stdout
function extractGuidFromFoundry(stdout: string): string | undefined {
  if (stdout.indexOf('already verified') !== -1) return;

  const bits = stdout.split('`');
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
  compiler = 'v0.7.6',
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
  verification: Verification,
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
  const { stdout, stderr } = await execAsync(toRun);
  if (stderr.length > 0) throw new Error(stderr);
  return extractGuidFromFoundry(stdout);
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
  const environment = process.argv[2];
  const jsonPath = process.argv[3];
  const jsonString = await readFileAsync(jsonPath, 'utf8');
  const verificationMap: Record<
    string,
    ReadonlyArray<Verification & { GUID?: string }>
  > = JSON.parse(jsonString);

  const context = new NomadContext(environment);

  for (const [network, verifications] of Object.entries(verificationMap)) {
    const chainId = context.mustGetDomain(network).specs.chainId;
    // run verification
    for (const verification of verifications) {
      const GUID = await forgeVerify(verification, chainId, 'v0.7.6', 999999);
      verification.GUID = GUID;
      console.log(verification.name, GUID ?? 'Already Verified');
      await delay(500);
    }
  }

  await writeFileAsync(jsonPath, JSON.stringify(verificationMap, null, 4));

  console.log('waiting 30 seconds before checking status');
  // Wait for 30 seconds before checking status
  await delay(30_000);

  for (const [network, verifications] of Object.entries(verificationMap)) {
    const chainId = context.mustGetDomain(network).specs.chainId;
    // Check that verification worked
    for (const verification of verifications) {
      const reason = await forgeCheck(verification.GUID, chainId);
      if (reason)
        console.error(
          `verification failed for ${verification.address}: ${reason}`,
        );
    }
  }
}

run();
