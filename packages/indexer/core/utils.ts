import { ethers } from "ethers";
import { NomadEvent } from "./event";
import fs from "fs";
import { Mean } from "./types";
import { DB } from "./db";
import Logger from "bunyan";
import pLimit from 'p-limit';

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function retry<T>(
  callback: () => Promise<T>,
  tries: number,
  onError: ((e: any) => Promise<void> | void) | undefined
): Promise<[T | undefined, any]> {
  let timeout = 2000;
  let lastError: any = undefined;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return [await callback(), undefined];
    } catch (e) {
      if (onError) await onError(e);
      lastError = e;
      await sleep(timeout * 2 ** attempt);
    }
  }
  return [undefined, lastError];
}

export function replacer(key: any, value: any): any {
  if (value instanceof Map) {
    return {
      dataType: "Map",
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else if (value instanceof NomadEvent) {
    return {
      dataType: "NomadEvent",
      value: value.toObject(), // or with spread: value: [...value]
    };
  } else if (value instanceof ethers.BigNumber) {
    return {
      dataType: "BigNumber",
      value: value.toHexString(), // or with spread: value: [...value]
    };
  } else if (value instanceof Mean) {
    return value.mean();
  } else {
    return value;
  }
}

export function reviver(key: any, value: any): any {
  if (typeof value === "object" && value !== null) {
    if (value.dataType === "Map") {
      return new Map(value.value);
    } else if (value.dataType === "NomadEvent") {
      return NomadEvent.fromObject(value.value);
    } else if (value.dataType === "BigNumber") {
      return ethers.BigNumber.from(value.value);
    } else if (value.type === "BigNumber") {
      return ethers.BigNumber.from(value.hex);
    }
  }
  return value;
}

export class KVCache {
  name: string;
  db: DB;
  limit: pLimit.Limit;

  constructor(name: string, db: DB) {
    this.db = db;
    this.name = name;
    this.limit = pLimit(1);
  }

  async init() {
    // await this.tryLoad();
  }

  async set(k: string, v: string) {
    await this.limit(() => this.db.setKeyPair(this.name, k, v));
  }

  async get(k: string): Promise<string | undefined> {
    return await this.db.getKeyPair(this.name, k)
  }
}

export function logToFile(s: string) {
  fs.appendFileSync("/tmp/log.log", s + "\n");
}

import crypto from "crypto";

export function hash(...vals: string[]): string {
  const hash = crypto.createHash("md5");
  vals.forEach((v) => hash.update(v));
  return hash.digest("hex");
}

export function createLogger(name: string, environment: string) {
  return Logger.createLogger({
    name,
    serializers: Logger.stdSerializers,
    level: "debug",
    environment: environment,
  });
}

export class Padded {
  private s: string;

  constructor(s: string) {
    if (s.length !== 66) throw new Error(`Input string length must be 66, got: ${s.length}`);
    if (s.slice(0, 2) !== '0x') throw new Error(`Input string length must start with '0x', got: ${s}`);
    this.s = s.toLowerCase();
  }

  toEVMAddress() {
    return "0x" + this.s.slice(26);
  }

  valueOf(): string {
    return this.s;
  }
}


export class FailureCounter {
  container: Date[];
  period: number;
  constructor(periodMins=60) {
    this.container = [];
    this.period = periodMins;
  }
  add() {
    this.container.push(new Date());
  }
  num(): number {
    let now = new Date();
    const cleanDates = this.container.filter(d => (now.valueOf() - d.valueOf()) <= 1000 * 60 * this.period); // millisec * 60 sec * period in mins
    this.container = cleanDates;
    return cleanDates.length;
  }
}