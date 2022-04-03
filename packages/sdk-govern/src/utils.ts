import { ethers } from 'ethers';
import { Address, Call, NormalizedCall } from '.';
import { utils as mpUtils } from '@nomad-xyz/multi-provider';

import Safe from '@gnosis.pm/safe-core-sdk';
import EthersAdapter from '@gnosis.pm/safe-ethers-lib';
import {
  SafeEthersSigner,
  SafeEthersSignerOptions,
  SafeService,
} from '@gnosis.pm/safe-ethers-adapters';

/**
 * Wrap an ethers Signer in a Gnosis Safe signer
 * @param safeAddress The address of the Gnosis Safe
 * @param signer The ethers signer to wrap. This signer SHOULD have ownership
 * rights over the safe.
 * @param serviceUrl The URL of the gnosis transaction service
 * @param options { pollingDelay?: number; }
 * @returns An ethers Signer connected to a gnosis safe
 */
export async function toSafeSigner(
  safeAddress: Address,
  signer: ethers.Signer,
  serviceUrl: string,
  options?: SafeEthersSignerOptions,
): Promise<SafeEthersSigner> {
  if (!signer.provider) throw new Error('No provider specified');
  const service = new SafeService(serviceUrl);
  const ethAdapter = new EthersAdapter({
    ethers,
    signer,
  });
  const safe = await Safe.create({ ethAdapter, safeAddress });
  return new SafeEthersSigner(safe, service, signer.provider, options);
}

// Returns the length (in bytes) of a BytesLike.
export function byteLength(bytesLike: ethers.utils.BytesLike): number {
  return ethers.utils.arrayify(bytesLike).length;
}

/**
 * Serialize a call to its packed Nomad governance representation
 * @param call The function call to serialize
 * @returns The serialized function call, as a '0x'-prepended hex string
 */
export function serializeCall(call: Call): string {
  const { to, data } = normalizeCall(call);
  const dataLen = byteLength(data);

  if (!to || !data) {
    throw new Error(`Missing data in Call: \n  ${call}`);
  }

  return ethers.utils.solidityPack(
    ['bytes32', 'uint32', 'bytes'],
    [to, dataLen, data],
  );
}

/**
 * Serialize a call array to its packed Nomad governance representation
 * @param batch The function calls to serialize
 * @returns The serialized function calls, as a '0x'-prepended hex string
 */
export function serializeCalls(batch: Call[]): Uint8Array {
  return ethers.utils.concat([
    [batch.length % 256], // 1 byte length of Call array
    ...batch.map(serializeCall), // each serialized call in turn
  ]);
}

/**
 * Calculates the hash commitment to a batch of calls
 * @param batch The function calls to be committed
 * @returns The hash commitment to the calls
 */
export function batchHash(batch: Call[]): string {
  return ethers.utils.keccak256(serializeCalls(batch));
}

export function formatBatch(batch: Call[]): string {
  const BATCH_TYPE = 1;
  return ethers.utils.hexConcat([[BATCH_TYPE], batchHash(batch)]);
}

export function associateRemotes(
  remoteCalls: Map<number, NormalizedCall[]>,
): [number[], NormalizedCall[][]] {
  const domains = [];
  const calls = [];
  for (const [key, value] of remoteCalls) {
    domains.push(key);
    calls.push(value);
  }
  return [domains, calls];
}

export function normalizeCall(call: Call): Readonly<NormalizedCall> {
  const to = ethers.utils.hexlify(mpUtils.canonizeId(call.to));
  const data = call.data ?? '0x';

  return Object.freeze({
    to,
    data,
  });
}
