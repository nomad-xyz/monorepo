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
  prefix: string; // prefix for all messages in this checklist
  ok: string[]; // successful items
  error: unknown[]; // failed items with associated error from chai assertion or plain error

  constructor(prefix: string | void) {
    this.prefix = prefix ? prefix : '';
    this.ok = [];
    this.error = [];
  }

  static combine(lists: CheckList[]): CheckList {
    const combinedList = new CheckList();
    lists.map((list) => {
      combinedList.ok.push(...list.ok);
      combinedList.error.push(...list.error);
    });
    return combinedList;
  }

  output(): void {
    // TODO: improve output readability
    console.log('Checklist: ', JSON.stringify(this, null, 2));
    if (this.hasErrors()) {
      throw new Error(
          `${this.ok.length} Checks Passed, ${this.error.length} Checks Failed.`,
      );
    } else {
      console.log('Checks Passed!');
    }
  }

  check(f: () => void, message: string): void {
    try {
      f();
      this.pass(message);
    } catch (e: unknown) {
      this.fail(e);
    }
  }

  exists<T>(value: T | undefined, message: string): void {
    this.check(() => expect(value, this.prefix + message).to.exist, message);
  }

  equals<T>(left: T, right: T | undefined, message: string): void {
    if (right === undefined) {
      this.fail(message + ' is undefined');
    } else {
      try {
        expect(left, this.prefix + message).to.be.equal(right);
        this.pass(message);
      } catch (e) {
        this.fail(e);
      }
    }
  }

  // This method tries to assert using expect(), in the worst case, uses utils.equalIds
  equalIds(
    left: BytesLike,
    right: BytesLike | undefined,
    message: string,
  ): void {
    if (right === undefined) {
      this.fail(message + ' is undefined');
    } else {
      try {
        expect(left, this.prefix + message).to.be.equal(right);
        this.pass(message);
      } catch (e) {
        if (utils.equalIds(left, right)) {
          this.pass(message);
        } else {
          this.fail(e);
        }
      }
    }
  }

  // This method tries to assert using expect(), in the worst case, uses utils.equalIds
  notEqualIds(
    left: BytesLike,
    right: BytesLike | undefined,
    message: string,
  ): void {
    if (right === undefined) {
      this.pass(message);
    } else {
      try {
        expect(left, this.prefix + message).to.be.not.equal(right);
        if (utils.equalIds(left, right)) {
          this.fail(message + `: expected ${left} to NOT equal ${right}`);
        } else {
          this.pass(message);
        }
      } catch (e) {
        this.fail(e);
      }
    }
  }

  assertBeaconProxy(
    beaconProxy: config.Proxy | undefined,
    message?: string,
  ): void {
    if (beaconProxy) {
      this.check(
        () =>
          expect(beaconProxy.beacon, this.prefix + message).to.not.be.undefined,
        message + ' beacon',
      );
      this.check(
        () =>
          expect(beaconProxy.proxy, this.prefix + message).to.not.be.undefined,
        message + ' proxy',
      );
      this.check(
        () =>
          expect(beaconProxy.implementation, this.prefix + message).to.not.be
            .undefined,
        message + ' implementation',
      );
    } else {
      this.fail(message + ' beacon is undefined');
      this.fail(message + ' proxy is undefined');
      this.fail(message + ' implementation is undefined');
    }
  }

  hasErrors(): boolean {
    return this.error.length > 0;
  }

  pass(msg: string): void {
    this.ok.push(this.prefix + msg);
  }

  fail(e: string | unknown): void {
    if (typeof e == 'string') {
      this.error.push(new Error(this.prefix + e));
    } else {
      this.error.push(e);
    }
  }
}
