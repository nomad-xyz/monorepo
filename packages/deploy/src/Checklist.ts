import chalk from 'chalk';
import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { utils } from '@nomad-xyz/multi-provider';
import * as config from '@nomad-xyz/configuration';

export interface Check {
  msg: string;
  check: () => void;
}

export interface CheckError {
  domain: string;
  message: string;
  error: string | unknown;
}

export class CheckList {
  domain: string; // domain for checks in this CheckList; e.g. ETHEREUM
  checkType: string; // type of checks in this Checklist; BRIDGE or CORE
  checksToRun: Check[];
  ok: string[]; // successful items
  error: CheckError[]; // failed items with associated error from chai assertion or plain error
  currentCheck: string;
  output: string[];

  constructor(domain: string | void, checkType: string | void) {
    this.domain = domain ? domain : '';
    this.checkType = checkType ? checkType : '';
    this.ok = [];
    this.error = [];
    this.currentCheck = '';
    this.checksToRun = [];
    this.output = ['\n'];
  }

  static combine(lists: CheckList[]): CheckList {
    const combinedList = new CheckList();
    lists.map((list) => {
      combinedList.ok.push(...list.ok);
      combinedList.error.push(...list.error);
    });
    return combinedList;
  }

  static printStart(environment: string): void {
    console.log('\n ' + chalk.bold.black.bgWhiteBright(`NOMAD DEPLOYMENT CHECK`));
    console.log(` ENV: ${chalk.green(environment.toUpperCase())}\n\n`);
    console.log(
      CheckList.formatColumn('STATUS', 'NETWORK', 'PART', 'PROTOCOL CHECK'),
    );
    console.log(CheckList.formatColumn('', '', '', ''));
  }

  addCheck(check: Check): void {
    this.currentCheck = check.msg;
    this.checksToRun.push(check);
  }

  async executeChecks(): Promise<void> {
    for (const c of this.checksToRun) {
      this.currentCheck = c.msg;
      try {
        await c.check();
      } catch (e) {
        this.fail(e);
      }
    }
    process.stdout.write(this.output.join('\n'));
    // Empty queue of checks that have not ran
    this.checksToRun.length = 0;
  }

  hasErrors(): boolean {
    return this.error.length > 0;
  }

  report(): void {
    if (this.hasErrors()) {
      console.log(
        `\nTest result: ${chalk.red('FAIL')} | ${this.ok.length} Passed, ${
          this.error.length
        } Failed.`,
      );
      console.log(`\n ${chalk.bold('Errors')} \n`);
      this.error.map((error) => {
        CheckList.colorDomain(error.domain);
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
    this.check(() => expect(value, this.domain + message).to.exist, message);
  }

  equals<T>(left: T, right: T | undefined): void {
    const message = this.currentCheck;
    if (right === undefined) {
      this.fail(message + ' is undefined');
    } else {
      try {
        if (typeof right == 'string' && typeof left == 'string') {
          expect(String(left).toLowerCase(), this.domain + message).to.be.equal(
            String(left).toLowerCase(),
          );
          this.pass(message);
        } else {
          expect(left, this.domain + message).to.be.equal(right);
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
        expect(left, this.domain + message).to.be.equal(right);
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
        expect(left, this.domain + message).to.be.not.equal(right);
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
          expect(beaconProxy.beacon, this.domain + message).to.not.be.undefined,
        `${message} -- beacon`,
      );
      this.check(
        () =>
          expect(beaconProxy.proxy, this.domain + message).to.not.be.undefined,
        `${message} -- proxy`,
      );
      this.check(
        () =>
          expect(beaconProxy.implementation, this.domain + message).to.not.be
            .undefined,
        `${message} -- implementation`,
      );
    } else {
      this.fail(message + ' beacon is undefined');
      this.fail(message + ' proxy is undefined');
      this.fail(message + ' implementation is undefined');
    }
  }

  private pass(msg: string): void {
    const out = this.formatCheck('success', msg);
    this.output.push(out);
    this.ok.push(out);
  }

  private fail(e: string | unknown): void {
    const out = this.formatCheck('fail', this.currentCheck);
    this.output.push(out);
    this.error.push({
      domain: this.domain,
      message: this.currentCheck,
      error: e,
    });
  }

  static colorDomain(d: string): string {
    if (d.toLowerCase().includes('polygon')) {
      return chalk.magenta(d);
    } else if (d.toLowerCase().includes('optimism')) {
      return chalk.red(d);
    } else if (d.toLowerCase().includes('ethereum')) {
      return chalk.blue(d);
    } else if (d.toLowerCase().includes('goerli')) {
      return chalk.blueBright(d);
    } else if (d.toLowerCase().includes('avalanche')) {
      return chalk.red(d);
    } else if (d.toLowerCase().includes('evmos')) {
      return chalk.bgWhiteBright.black(d);
    } else if (d.toLowerCase().includes('milkomeda')) {
      return chalk.white(d);
    } else if (d.toLowerCase().includes('moon')) {
      return chalk.blueBright(d);
    } else if (d.toLowerCase().includes('rinkeby')) {
      return chalk.cyan(d);
    }
    return d;
  }

  private formatCheck(status: string, msg: string): string {
    return CheckList.formatColumn(status, this.domain, this.checkType, msg);
  }

  private static formatColumn(
    one: string,
    two: string,
    three: string,
    four: string,
  ) {
    return ` ${CheckList.formatColOne(one)} | ${CheckList.formatColTwo(
      two,
    )} | ${CheckList.formatColThree(three)} | ${four}`;
  }

  private static formatLen(str: string, len: number) {
    const rep = len - str.length;
    return `${str}${' '.repeat(rep > 0 ? rep : 0)}`;
  }

  private static formatColOne(d: string) {
    const ONE_LEN = 7;
    if (d.toLowerCase().includes('pending')) {
      return chalk.white(CheckList.formatLen('[PENDING]', ONE_LEN));
    } else if (d.toLowerCase().includes('success')) {
      return chalk.green(CheckList.formatLen('[PASS]', ONE_LEN));
    } else if (d.toLowerCase().includes('fail')) {
      return chalk.red(CheckList.formatLen('[FAIL]', ONE_LEN));
    }
    return CheckList.formatLen(d, ONE_LEN);
  }

  private static formatColTwo(d: string) {
    const TWO_LEN = 15;
    return CheckList.colorDomain(CheckList.formatLen(d, TWO_LEN));
  }

  private static formatColThree(d: string) {
    const THREE_LEN = 10;
    return CheckList.formatLen(d, THREE_LEN);
  }
}
