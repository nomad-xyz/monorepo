import ethers from 'ethers';
import * as config from '@nomad-xyz/configuration';

export type SignerOrProvider = ethers.providers.Provider | ethers.Signer;

export function log(str: string): void {
  console.log(str);
}

export function _unreachable(): void {
  throw new Error('unreachable');
}

export function assertBeaconProxy(
  beaconProxy: config.Proxy,
  name: string,
): any[] {
  const errors = [];
  if (beaconProxy.beacon === undefined) errors.push(new Error(`${name} proxy's beacon is undefined`));
  if (beaconProxy.proxy === undefined) errors.push(new Error(`${name} proxy's proxy is undefined`));
  if (beaconProxy.implementation === undefined) errors.push(new Error(`${name} proxy's implementation is undefined`));
  return errors;
}
