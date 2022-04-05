import ethers from 'ethers';
import { expect } from 'chai';
import * as config from '@nomad-xyz/configuration';
import { clearTimeout } from 'timers';
import  Logger  from 'bunyan';

export type SignerOrProvider = ethers.providers.Provider | ethers.Signer;

export function log(str: string): void {
  console.log(str);
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


// Retry functionality
export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function retry<T>(
  callback: (i: number) => Promise<T>,
  tries: number,
  onError: ((e: any, i: number) => Promise<void> | void) | undefined,
  ms?: number,
  logger?: Logger,
  factor: number = 5,
): Promise<T> {
  let timeoutX = 1000;
  let lastError: any = undefined;
  for (let attempt = 0; attempt < tries; attempt++) {
    let warningTimeout: NodeJS.Timeout | undefined = undefined;
    let timeout: NodeJS.Timeout | undefined = undefined;
    let candidate = false;
    try {

      let tempReject: ((reason?: any) => void) | undefined = undefined;
      const promise = new Promise(async (resolve: (x: T) => void, reject) => {
        tempReject = reject;
        try {
          resolve(await callback(attempt));
        } catch(e) {
          reject(e);
          tempReject = undefined;
        }
      });

      
      if (ms && ms >= 2000) {
        warningTimeout = setTimeout(()=>{
          candidate = true;
          if (logger) logger.warn(`Some retry promise is going to get autorejected in ${ms / 1000} sec due to reaching half of waiting time...`)
        }, ms/2);
      }
      
      
      if (ms) {
        timeout = setTimeout(()=>{
          if (tempReject) {
            if (logger) logger.error(`Autorejected some retry in ${ms / 1000} sec due to reaching half of waiting time...`)
            tempReject(new Error(`Watited for the promise for too long...`));
          }
        }, ms);
      }
      

      const result = await promise;
      if (timeout) clearTimeout(timeout);
      if (warningTimeout) clearTimeout(warningTimeout);
      if (candidate && logger) logger.debug(`Autoreject canceled as it resolved...`);
      return result;
    } catch (e) {
      if (timeout) clearTimeout(timeout);
      if (warningTimeout) clearTimeout(warningTimeout);
      if (onError) await onError(e, attempt);
      lastError = e;
      await sleep(timeoutX * factor * (2**(attempt + 1)));
    }
  }
  throw lastError
}

// export async function retry<T>(
//   callback: (i: number) => Promise<T>,
//   tries: number,
//   onError: ((e: any, i: number) => Promise<void> | void) | undefined,
//   factor: number = 5,
// ): Promise<T> {
//   let timeout = 2000;
//   let lastError: any = undefined;
//   for (let attempt = 0; attempt < tries; attempt++) {
//     try {
//       return await callback(attempt);
//     } catch (e) {
//       if (onError) await onError(e, attempt);
//       lastError = e;
//       await sleep(timeout * (2 * factor) ** attempt);
//     }
//   }
//   throw lastError
// }