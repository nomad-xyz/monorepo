import ethers from 'ethers';
import { expect } from 'chai';
import * as config from '@nomad-xyz/configuration';

export type SignerOrProvider = ethers.providers.Provider | ethers.Signer;

export function log(str: string): void {
  console.log(str);
}

export function _notImplemented<T>(...args: ReadonlyArray<unknown>): T {
  args;
  throw new Error('Not implemented');
}

export function _unreachable(): void {
  throw new Error('unreachable');
}

export function assertBeaconProxy(
  beaconProxy: config.Proxy,
  message?: string,
): void {
  expect(beaconProxy.beacon, message).to.not.be.undefined;
  expect(beaconProxy.proxy, message).to.not.be.undefined;
  expect(beaconProxy.implementation, message).to.not.be.undefined;
}
