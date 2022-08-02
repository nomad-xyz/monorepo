import ethers, { BytesLike } from 'ethers';
import { expect } from 'chai';
import * as config from '@nomad-xyz/configuration';
import { utils } from '@nomad-xyz/multi-provider';
import chalk from 'chalk';
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

export interface checkToRun {
  msg: string;
  check: () => void;
}

export interface checkError {
  network: string;
  message: string;

  error: any;
}

export class CheckList {
  prefix: string; // prefix for all messages in this checklist
  part: string;
  ok: string[]; // successful items
  error: checkError[]; // failed items with associated error from chai assertion or plain error
  //
  currentCheck: string;

  outputString: string;

  checksToRun: checkToRun[];

  addCheck(check: checkToRun) {
    this.currentCheck = check.msg;
    this.checksToRun.push(check);
  }

  async executeChecks() {
    for (const c of this.checksToRun) {
      this.currentCheck = c.msg;
      try {
        await c.check();
      } catch (e) {
        this.fail(e);
      }
    }
    process.stdout.write(this.outputString);
    // Empty queue of checks that have not ran
    this.checksToRun.length = 0;
  }

  constructor(prefix: string | void, part: string | void) {
    this.prefix = prefix ? prefix : '';
    this.part = part ? part : '';
    this.ok = [];
    this.error = [];
    this.currentCheck = '';
    this.checksToRun = [];
    this.outputString = '';
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
    if (this.hasErrors()) {
      console.log(
        `\nTest result: ${chalk.red('FAIL')} | ${this.ok.length} Passed, ${
          this.error.length
        } Failed.`,
      );
      console.log(`\n ${chalk.bold('Errors')} \n`);
      this.error.map((error) => {
        this.colorNetwork(error.network);
        console.log(`Check: ${chalk.red(error.message)}`);
        console.log(error.error);
      });
    } else {
      console.log(
        `\nTest result: ${chalk.green('OK')} | ${
          this.ok.length
        } Checks Passed!`,
      );
    }
  }

  check(f: () => void, message: string): void {
    try {
      f();
      this.pass(message);
    } catch (e) {
      this.fail(e);
    }
  }

  exists<T>(value: T | undefined): void {
    const message = this.currentCheck;
    this.check(() => expect(value, this.prefix + message).to.exist, message);
  }

  equals<T>(left: T, right: T | undefined): void {
    const message = this.currentCheck;
    if (right === undefined) {
      this.fail(message + ' is undefined');
    } else {
      try {
        if (typeof right == 'string' && typeof left == 'string') {
          expect(String(left).toLowerCase(), this.prefix + message).to.be.equal(
            String(left).toLowerCase(),
          );
          this.pass(message);
        } else {
          expect(left, this.prefix + message).to.be.equal(right);
          this.pass(message);
        }
      } catch (e) {
        this.fail(e);
      }
    }
  }

  // This method tries to assert using expect(), in the worst case, uses utils.equalIds
  equalIds(left: BytesLike, right: BytesLike | undefined): void {
    const message = this.currentCheck;
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
  notEqualIds(left: BytesLike, right: BytesLike | undefined): void {
    const message = this.currentCheck;
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

  assertBeaconProxy(beaconProxy: config.Proxy | undefined): void {
    const message = this.currentCheck;
    if (beaconProxy) {
      this.check(
        () =>
          expect(beaconProxy.beacon, this.prefix + message).to.not.be.undefined,
        `${message} -- beacon`,
      );
      this.check(
        () =>
          expect(beaconProxy.proxy, this.prefix + message).to.not.be.undefined,
        `${message} -- proxy`,
      );
      this.check(
        () =>
          expect(beaconProxy.implementation, this.prefix + message).to.not.be
            .undefined,
        `${message} -- implementation`,
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
    const out = this.formatCheck('success', msg);
    this.outputString = `${this.outputString}${out}\n`;
    // console.log(out);
    this.ok.push(out);
  }

  fail(e: string | unknown): void {
    const out = this.formatCheck('fail', this.currentCheck);
    // console.log(out);
    this.outputString = `${this.outputString}${out}\n`;
    this.error.push({
      network: this.prefix,
      message: this.currentCheck,
      error: e,
    });
  }
  formatCheck(status: string, msg: string): string {
    if (status == 'pending') {
      status = chalk.white('[PENDING]');
    } else if (status == 'success') {
      status = chalk.green('[PASS]');
    } else if (status == 'fail') {
      status = chalk.red('[FAIL]');
    }
    const out = `  ${status} | ${this.colorNetwork(this.prefix)}${' '.repeat(
      15 - this.prefix.length,
    )} | ${this.part}${' '.repeat(10 - this.part.length)} | ${msg}`;
    return out;
  }

  colorNetwork(n: string): string {
    n = chalk.bold(n);
    if (n.toLowerCase().includes('polygon')) {
      return chalk.magenta(n);
    } else if (n.toLowerCase().includes('optimism')) {
      return chalk.red(n);
    } else if (n.toLowerCase().includes('ethereum')) {
      return chalk.blue(n);
    } else if (n.toLowerCase().includes('goerli')) {
      return chalk.blueBright(n);
    } else if (n.toLowerCase().includes('avalanche')) {
      return chalk.red(n);
    } else if (n.toLowerCase().includes('evmos')) {
      return chalk.bgWhiteBright.black(n);
    } else if (n.toLowerCase().includes('milkomeda')) {
      return chalk.white(n);
    } else if (n.toLowerCase().includes('moon')) {
      return chalk.blueBright(n);
    } else {
      return n;
    }
  }
}
