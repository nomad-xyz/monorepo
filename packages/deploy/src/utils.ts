import ethers, { BytesLike } from 'ethers';
import { expect } from 'chai';
import * as config from '@nomad-xyz/configuration';
import { utils } from '@nomad-xyz/multi-provider';

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

export class CheckList {
  ok: string[]; // successful items
  error: [string, any][]; // failed items with associated error from chai assertion or plain error
  constructor() {
    this.ok = [];
    this.error = [];
  }

  check(f: () => void, message: string) {
    try {
      f();
      this.ok.push(message);
    } catch (e: any) {
      this.error.push([message, e]);
    }
  }

  exists<T>(value: T, message: string) {
    this.check(() => expect(value, message).to.exist, message);
  }

  equals<T>(left: T, right: T | undefined, message: string) {
    if (right === undefined) {
      this.error.push([message, new Error(message + ' is undefined')]);
    } else {
      try {
        expect(left, message).to.be.equal(right);
      } catch (e) {
        this.error.push([message + `(left: ${left}, right: ${right})`, e]);
      }
    }
  }

  // This method tries to assert using expect(), in the worst case, uses utils.equalIds
  equalIds(left: BytesLike, right: BytesLike | undefined, message: string) {
    if (right === undefined) {
      this.error.push([message, new Error(message + ' is undefined')]);
    } else {
      try {
        expect(left, message).to.be.equal(right);
      } catch (e) {
        if (utils.equalIds(left, right)) {
          this.ok.push(message);
        } else {
          this.error.push([message + `(left: ${left}, right: ${right})`, e]);
        }
      }
    }
  }

  // This method tries to assert using expect(), in the worst case, uses utils.equalIds
  notEqualIds(left: BytesLike, right: BytesLike | undefined, message: string) {
    if (right === undefined) {
      this.ok.push(message);
    } else {
      try {
        expect(left, message).to.be.not.equal(right);

        if (utils.equalIds(left, right)) {
          this.error.push([message, new Error(message)]);
        } else {
          this.ok.push(message);
        }
      } catch (e) {
        this.error.push([message, e]);
      }
    }
  }

  assertBeaconProxy(
    beaconProxy: config.Proxy | undefined,
    message?: string,
  ): void {
    if (beaconProxy) {
      this.check(
        () => expect(beaconProxy.beacon, message).to.not.be.undefined,
        message + ' beacon',
      );
      this.check(
        () => expect(beaconProxy.proxy, message).to.not.be.undefined,
        message + ' proxy',
      );
      this.check(
        () => expect(beaconProxy.implementation, message).to.not.be.undefined,
        message + ' implementation',
      );
    } else {
      this.error.push([
        message + ' beacon',
        new Error(message + ' beacon is undefined'),
      ]);
      this.error.push([
        message + ' proxy',
        new Error(message + ' proxy is undefined'),
      ]);
      this.error.push([
        message + ' implementation',
        new Error(message + ' implementation is undefined'),
      ]);
    }
  }

  hasErrors(): boolean {
    return this.error.length > 0;
  }
}
