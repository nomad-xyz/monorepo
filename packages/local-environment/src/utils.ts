import * as Stream from "stream";
import { ethers } from "ethers";
import { Key } from "./key";

export function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function readLine(q: string): Promise<string> {
  const readline = require("readline");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let response: string;

  rl.setPrompt(q);
  rl.prompt();

  return new Promise((resolve, reject) => {
    rl.on("line", (userInput: string) => {
      response = userInput;
      rl.close();
    });

    rl.on("close", () => {
      resolve(response);
    });
  });
}

export function paddedZeros(x: string): string {
  return x + [...Array(64 - x.length * 2).keys()].map((_) => 0).join("") + x;
}

export function randomTillPoint(n: number): number {
  return Math.floor(Math.random() * 10 ** n) / 10 ** n;
}

export class Waiter<T> {
  interval: NodeJS.Timeout;
  timeout: NodeJS.Timeout;
  promise: Promise<T | null>;
  resolve: ((result: T | null) => void) | undefined;
  reject: ((error: any) => void) | undefined;

  constructor(
    callback: () => Promise<T | undefined>,
    timeoutMs: number,
    retryMs: number
  ) {
    this.resolve = undefined;
    this.reject = undefined;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    this.interval = setInterval(async () => {
      try {
        const result = await callback();
        if (result != undefined) {
          this.succeed(result);
        }
      } catch (e) {
        this.fail(e);
      }
    }, retryMs);

    this.timeout = setTimeout(this.doTimeout.bind(this), timeoutMs);
  }

  fail(e: any) {
    if (this.reject) this.reject(e);
    this.stop();
  }

  succeed(value: T) {
    if (this.resolve) this.resolve(value);
    this.stop();
  }

  doTimeout() {
    if (this.resolve) this.resolve(null);
    this.stop();
  }

  stop(): void {
    clearInterval(this.interval);
    clearTimeout(this.timeout);
  }

  async wait(): Promise<T | null> {
    return await this.promise;
  }
}

class Matcher {
  pattern: RegExp;
  executor:
    | string
    | ((match: RegExpMatchArray) => Promise<void>)
    | ((match: RegExpMatchArray) => void);

  constructor(
    pattern: RegExp,
    executor:
      | string
      | ((match: RegExpMatchArray) => Promise<void>)
      | ((match: RegExpMatchArray) => void)
  ) {
    this.pattern = pattern;
    this.executor = executor;
  }
}

export class StreamMatcher extends Stream.Transform {
  pattern2executor: Map<string, Matcher>;
  constructor() {
    super();
    this.pattern2executor = new Map();
    this.subscribe();
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    this.push(chunk);
    callback();
  }

  subscribe() {
    this.on("data", async (chunk: Buffer) => {
      if (!this.pattern2executor.size) return;

      const str = chunk.toString("utf8");

      let matches: Iterable<RegExpMatchArray>;
      for (const [_, p2e] of this.pattern2executor) {
        if (p2e.pattern.global) {
          matches = str.matchAll(p2e.pattern);
        } else {
          const match = str.match(p2e.pattern);
          matches = match ? [match] : [];
        }

        for (const match of matches) {
          if (typeof p2e.executor === "string") {
            this.emit(p2e.executor, match);
          } else {
            await p2e.executor(match);
          }
        }
      }
    });
  }

  unregisterAll(): void {
    this.pattern2executor = new Map();
  }

  unregister(pattern: RegExp | string): void {
    this.pattern2executor.delete(pattern.toString());
  }

  register(
    pattern: RegExp,
    executor:
      | string
      | ((match: RegExpMatchArray) => Promise<void>)
      | ((match: RegExpMatchArray) => void)
  ): void {
    this.pattern2executor.set(
      pattern.toString(),
      new Matcher(pattern, executor)
    );
  }
}

function domainHash(domain: Number): string {
  return ethers.utils.solidityKeccak256(
    ["uint32", "string"],
    [domain, "NOMAD"]
  );
}

export function signUpdate(
  signer: ethers.Wallet,
  domain: number,
  oldRoot: string,
  newRoot: string
): Promise<string> {
  let message = getMessage(domain, oldRoot, newRoot);
  let msgHash = ethers.utils.arrayify(ethers.utils.keccak256(message));
  return signer.signMessage(msgHash);
}

function getMessage(
  domain: number,
  oldRoot: string,
  newRoot: string
): Uint8Array {
  return ethers.utils.concat(
    [domainHash(domain), oldRoot, newRoot].map((x) => {
      return ethers.utils.arrayify(x);
    })
  );
}

export function generateDefaultKeys() {
  return {
    updater: new Key(),
    watcher: new Key(),
    deployer: new Key(),
    signer: {
      base: new Key(),
      updater: new Key(),
      watcher: new Key(),
      relayer: new Key(),
      processor: new Key(),
    },
  };
}

/**
 * An analog of `zip` from Python. Takes 2 arrays
 * of same length, and forms andother array, where
 * each item is a pair of items from both arrays, like
 * `new_arr[i] = [a[i], b[i]]`.
 * @param a an array
 * @param b another array
 * @returns zipped array of both `a` and `b`
 */
export function zip<A, B>(a: A[], b: B[]): [A, B][] {
  if (a.length != b.length)
    throw new Error(
      `Zipping 2 arrays of different length is wrong. a: ${a.length}, b: ${b.length}`
    );
  return a.map((x, i) => [x, b[i]]);
}

export function getRandomTokenAmount(): ethers.BigNumber {
  return ethers.utils.parseEther(String(randomTillPoint(2) + 0.01));
}

export function filterUndefined<T>(arr: (T | undefined)[]): T[] {
  const f = (item: T | undefined): item is T => {
    return !!item;
  };
  return arr.filter(f);
}
