import { ethers } from 'ethers';
import { TypedEvent } from '@nomad-xyz/contract-interfaces/core/commons';

type Result = ethers.utils.Result;

const blockTimesSeconds: Map<string, number> = new Map([
  ['ethereum', 15],
  ['celo', 5],
  ['polygon', 2],
  ['alfajores', 5],
  ['rinkeby', 15],
  ['kovan', 4],
  ['moonbasealpha', 14],
  ['moonbeam', 14],
]);

const fraudWindowSeconds: Map<string, number> = new Map([
  ['ethereum', 60 * 60 * 3],
  ['celo', 60 * 15],
  ['polygon', 60 * 15],
  ['alfajores', 10],
  ['rinkeby', 10],
  ['kovan', 10],
  ['moonbasealpha', 10],
  ['moonbeam', 10],
]);

// timelag_blocks * block_time
const timelagsSeconds: Map<string, number> = new Map([
  ['ethereum', 20 * 15],
  ['celo', 5 * 5],
  ['polygon', 200 * 2],
  ['alfajores', 5 * 5],
  ['rinkeby', 60 * 15],
  ['kovan', 5 * 4],
  ['moonbasealpha', 5 * 15],
  ['moonbeam', 5 * 15],
]);

export function getFraudWindowSeconds(network: string): number {
  return fraudWindowSeconds.get(network)!;
}

export function getTimelagSeconds(network: string): number {
  return timelagsSeconds.get(network)!;
}

export function blocksToSeconds(network: string, blocks: number): number {
  return blocks * blockTimesSeconds.get(network)!;
}

export function secondsToBlocks(network: string, seconds: number): number {
  return seconds / blockTimesSeconds.get(network)!;
}

export function compareEvents(
  a: TypedEvent<Result>,
  b: TypedEvent<Result>,
): number {
  if (a.blockNumber < b.blockNumber) {
    return -1;
  } else if (a.blockNumber > b.blockNumber) {
    return 1;
  } else {
    if (a.transactionIndex < b.transactionIndex) {
      return -1;
    } else {
      return 1;
    }
  }
}
