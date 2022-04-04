import ethers from 'ethers';

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
