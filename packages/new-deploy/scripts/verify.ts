// --chain-id
// --compiler-version
// --num-of-optimizations

// address
// path/to/Contracts.sol:ContractName
// etherscan-key

import { readFile } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Verification } from '../src';
import * as dotenv from 'dotenv';
import { NomadContext } from '@nomad-xyz/sdk';
dotenv.config();

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);

const etherscanKey = process.env.ETHERSCAN_KEY;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function command(
  verification: Verification,
  chainId = 1,
  compiler = '0.7.6',
  optimizations = 999999,
): string {
  return `forge verify-contract --chain-id ${chainId} --compiler-version ${compiler} --num-of-optimizations = ${optimizations} ${verification.address} ${verification.specifier} ${etherscanKey}`;
}

export async function verify(
  verification: Verification,
  chainId?: number,
  compiler?: string,
  optimizations?: number,
): Promise<void> {
  const toRun = command(verification, chainId, compiler, optimizations);
  const { stdout, stderr } = await execAsync(toRun);
  console.log(stdout);
  if (stderr.length > 0) console.error(stderr);
}

run();

async function run() {
  const environment = process.argv[0];
  const jsonPath = process.argv[1];
  const jsonString = await readFileAsync(jsonPath, 'utf8');
  const verificationMap: Record<
    string,
    ReadonlyArray<Verification>
  > = JSON.parse(jsonString);

  const context = new NomadContext(environment);

  for (const [network, verifications] of Object.entries(verificationMap)) {
    const chainId = context.getDomain(network).specs.chainId;
    for (const verification of verifications) {
      await verify(verification, chainId);
      await delay(500);
    }
  }
}
