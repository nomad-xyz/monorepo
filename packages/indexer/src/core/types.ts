import { createClient } from 'redis';
export type RedisClient = ReturnType<typeof createClient>;
export class Mean {
  count: number;
  total: number;
  constructor() {
    this.count = 0;
    this.total = 0;
  }
  add(value: number): void {
    this.count += 1;
    this.total += value;
  }
  mean(): number {
    return this.total / this.count;
  }
}

type CountStages = {
  dispatched: number;
  updated: number;
  relayed: number;
  received: number;
  processed: number;
};

export class BasicCountStages {
  dispatched: number;
  updated: number;
  relayed: number;
  received: number;
  processed: number;
  constructor() {
    this.dispatched = 0;
    this.updated = 0;
    this.relayed = 0;
    this.received = 0;
    this.processed = 0;
  }

  toObject(): CountStages {
    return {
      dispatched: this.dispatched,
      updated: this.updated,
      relayed: this.relayed,
      received: this.received,
      processed: this.processed,
    };
  }
}

type Timing = {
  meanUpdate: number;
  meanRelay: number;
  meanReceive: number;
  meanProcess: number;
  meanE2E: number;
};

export class BasicTiming {
  meanUpdate: Mean;
  meanRelay: Mean;
  meanReceive: Mean;
  meanProcess: Mean;
  meanE2E: Mean;
  constructor() {
    this.meanUpdate = new Mean();
    this.meanRelay = new Mean();
    this.meanReceive = new Mean();
    this.meanProcess = new Mean();
    this.meanE2E = new Mean();
  }

  toObject(): Timing {
    return {
      meanUpdate: this.meanUpdate.mean(),
      meanRelay: this.meanRelay.mean(),
      meanReceive: this.meanReceive.mean(),
      meanProcess: this.meanProcess.mean(),
      meanE2E: this.meanE2E.mean(),
    };
  }
}

type Stat<T, DS> = {
  total: T;
  domainStatistics: DS;
};

type DomainStatistics<T> = (number | T)[][];

type TimingStatistic = Stat<Timing, DomainStatistics<Timing>>;

export class RootTimingStatistic {
  total: BasicTiming;
  domainStatistics: Map<number, BasicTiming>;
  constructor(domains: number[]) {
    this.total = new BasicTiming();
    this.domainStatistics = new Map(domains.map((d) => [d, new BasicTiming()]));
  }

  toObject(): TimingStatistic {
    return {
      total: this.total.toObject(),
      domainStatistics: Array.from(this.domainStatistics.entries()).map(
        ([d, v]) => [d, v.toObject()],
      ),
    };
  }
}

type CountStagesStatistic = Stat<CountStages, DomainStatistics<CountStages>>;
export class RootCountStagesStatistic {
  total: BasicCountStages;
  domainStatistics: Map<number, BasicCountStages>;
  constructor(domains: number[]) {
    this.total = new BasicCountStages();
    this.domainStatistics = new Map(
      domains.map((d) => [d, new BasicCountStages()]),
    );
  }

  toObject(): CountStagesStatistic {
    return {
      total: this.total.toObject(),
      domainStatistics: Array.from(this.domainStatistics.entries()).map(
        ([d, v]) => [d, v.toObject()],
      ),
    };
  }
}

type Stats = {
  counts: CountStagesStatistic;
  timings: TimingStatistic;
};

type DomainStats = {
  counts: CountStages;
  timings: Timing;
};

export class Statistics {
  counts: RootCountStagesStatistic;
  timings: RootTimingStatistic;
  constructor(domains: number[]) {
    this.counts = new RootCountStagesStatistic(domains);
    this.timings = new RootTimingStatistic(domains);
  }

  toObject(): Stats {
    return {
      counts: this.counts.toObject(),
      timings: this.timings.toObject(),
    };
  }

  forDomain(domain: number): DomainStats {
    // TODO: type the below Maps at runtime for
    // each domain to get rid of the non-null assertion
    const counts = this.counts.domainStatistics.get(domain)!.toObject();
    const timings = this.timings.domainStatistics.get(domain)!.toObject();
    return {
      counts,
      timings,
    };
  }
}

export const state2str = [
  'dispatched',
  'updated',
  'relayed',
  'received',
  'processed',
];
