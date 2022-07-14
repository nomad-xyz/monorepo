import { ethers } from 'ethers';
import { NomadishEvent } from './event';
import { Statistics } from './types';
import EventEmitter from 'events';
import { NomadMessage } from './consumerV2';

export class StatisticsCollector {
  s: Statistics;
  constructor(domains: number[]) {
    this.s = new Statistics(domains);
  }

  addDispatched(domain: number): void {
    this.s.counts.total.dispatched += 1;
    if (this.s.counts.domainStatistics.has(domain))
      this.s.counts.domainStatistics.get(domain)!.dispatched += 1;
  }

  addUpdated(domain: number) {
    this.s.counts.total.updated += 1;
    if (this.s.counts.domainStatistics.has(domain))
      this.s.counts.domainStatistics.get(domain)!.updated += 1;
  }

  addRelayed(domain: number) {
    this.s.counts.total.relayed += 1;
    if (this.s.counts.domainStatistics.has(domain))
      this.s.counts.domainStatistics.get(domain)!.relayed += 1;
  }

  addReceived(domain: number) {
    this.s.counts.total.received += 1;
    if (this.s.counts.domainStatistics.has(domain))
      this.s.counts.domainStatistics.get(domain)!.received += 1;
  }

  addProcessed(domain: number) {
    this.s.counts.total.processed += 1;
    if (this.s.counts.domainStatistics.get(domain))
      this.s.counts.domainStatistics.get(domain)!.processed += 1;
  }

  contributeToCount(m: NomadMessage) {
    switch (m.state) {
      case MsgState.Dispatched:
        this.addDispatched(m.origin);
        break;
      case MsgState.Updated:
        this.addUpdated(m.origin);
        break;
      case MsgState.Relayed:
        this.addRelayed(m.origin);
        break;
      case MsgState.Received:
        this.addReceived(m.origin);
        break;
      case MsgState.Processed:
        this.addProcessed(m.origin);
        break;
      default:
        break;
    }
  }

  stats(): Statistics {
    return this.s;
  }
}

export abstract class Consumer extends EventEmitter {
  abstract consume(evens: NomadishEvent[]): Promise<void>;
}

enum MsgState {
  Dispatched,
  Updated,
  Relayed,
  Received,
  Processed,
}

export class GasUsed {
  dispatch: ethers.BigNumber;
  update: ethers.BigNumber;
  relay: ethers.BigNumber;
  receive: ethers.BigNumber;
  process: ethers.BigNumber;

  constructor() {
    this.dispatch = ethers.BigNumber.from(0);
    this.update = ethers.BigNumber.from(0);
    this.relay = ethers.BigNumber.from(0);
    this.receive = ethers.BigNumber.from(0);
    this.process = ethers.BigNumber.from(0);
  }

  serialize() {
    return {
      gasAtDispatch: this.dispatch.toHexString(),
      gasAtUpdate: this.update.toHexString(),
      gasAtRelay: this.relay.toHexString(),
      gasAtReceive: this.receive.toHexString(),
      gasAtProcess: this.process.toHexString(),
    };
  }

  static deserialize(o: {
    gasAtDispatch: string;
    gasAtUpdate: string;
    gasAtRelay: string;
    gasAtReceive: string;
    gasAtProcess: string;
  }): GasUsed {
    const g = new GasUsed();
    g.dispatch = ethers.BigNumber.from(o.gasAtDispatch);
    g.update = ethers.BigNumber.from(o.gasAtUpdate);
    g.relay = ethers.BigNumber.from(o.gasAtRelay);
    g.receive = ethers.BigNumber.from(o.gasAtReceive);
    g.process = ethers.BigNumber.from(o.gasAtProcess);
    return g;
  }
}

export class Timings {
  dispatchedAt: number;
  updatedAt: number;
  relayedAt: number;
  processedAt: number;
  receivedAt: number;

  constructor(ts: number) {
    this.dispatchedAt = ts;
    this.updatedAt = 0;
    this.relayedAt = 0;
    this.processedAt = 0;
    this.receivedAt = 0;
  }

  updated(ts: number) {
    this.updatedAt = ts;
  }

  relayed(ts: number) {
    this.relayedAt = ts;
  }

  received(ts: number) {
    this.receivedAt = ts;
  }

  processed(ts: number) {
    this.processedAt = ts;
  }

  toUpdate(): number | undefined {
    if (this.updatedAt) {
      return Math.floor((this.updatedAt - this.dispatchedAt) / 1000);
    }
    return undefined;
  }

  toRelay(): number | undefined {
    if (this.relayedAt) {
      return Math.floor(
        (this.relayedAt - Math.max(this.updatedAt, this.dispatchedAt)) / 1000,
      ); // because of the problem with time that it is not ideal from RPC we could have skipped some stages. we take the last available
    }
    return undefined;
  }

  toReceive(): number | undefined {
    if (this.receivedAt) {
      return Math.floor(
        (this.receivedAt -
          Math.max(this.relayedAt, this.updatedAt, this.dispatchedAt)) /
          1000,
      ); // because of the problem with time that it is not ideal from RPC we could have skipped some stages. we take the last available
    }
    return undefined;
  }

  toProcess(): number | undefined {
    if (this.processedAt) {
      return Math.floor(
        (this.processedAt - // Attention:   this.receivedAt is not what we are interested here
          Math.max(this.relayedAt, this.updatedAt, this.dispatchedAt)) /
          1000,
      ); // because of the problem with time that it is not ideal from RPC we could have skipped some stages. we take the last available
    }
    return undefined;
  }

  toE2E(): number | undefined {
    if (this.processedAt) {
      return Math.floor((this.processedAt - this.dispatchedAt) / 1000); // because of the problem with time that it is not ideal from RPC we could have skipped some stages. we take the last available
    }
    return undefined;
  }

  serialize() {
    return {
      dispatchedAt: Math.floor(this.dispatchedAt / 1000),
      updatedAt: Math.floor(this.updatedAt / 1000),
      relayedAt: Math.floor(this.relayedAt / 1000),
      processedAt: Math.floor(this.processedAt / 1000),
      receivedAt: Math.floor(this.receivedAt / 1000),
    };
  }

  static deserialize(s: {
    dispatchedAt: number;
    updatedAt: number;
    relayedAt: number;
    processedAt: number;
    receivedAt: number;
  }): Timings {
    const t = new Timings(s.dispatchedAt * 1000);
    t.updatedAt = s.updatedAt * 1000;
    t.relayedAt = s.relayedAt * 1000;
    t.processedAt = s.processedAt * 1000;
    t.receivedAt = s.receivedAt * 1000;
    return t;
  }
}
