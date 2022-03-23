export class Mean {
  count: number;
  total: number;
  constructor() {
    this.count = 0;
    this.total = 0;
  }
  add(value: number) {
    this.count += 1;
    this.total += value;
  }
  mean(): number {
    return this.total / this.count;
  }
}

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

  toObject() {
    return {
      dispatched: this.dispatched,
      updated: this.updated,
      relayed: this.relayed,
      received: this.received,
      processed: this.processed,
    };
  }
}

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

  toObject() {
    return {
      meanUpdate: this.meanUpdate.mean(),
      meanRelay: this.meanRelay.mean(),
      meanReceive: this.meanReceive.mean(),
      meanProcess: this.meanProcess.mean(),
      meanE2E: this.meanE2E.mean(),
    };
  }
}

export class RootTimingStatistic {
  total: BasicTiming;
  domainStatistics: Map<number, BasicTiming>;
  constructor(domains: number[]) {
    this.total = new BasicTiming();
    this.domainStatistics = new Map(domains.map((d) => [d, new BasicTiming()]));
  }

  toObject() {
    return {
      total: this.total.toObject(),
      domainStatistics: Array.from(this.domainStatistics.entries()).map(
        ([d, v]) => [d, v.toObject()]
      ),
    };
  }
}

export class RootCountStagesStatistic {
  total: BasicCountStages;
  domainStatistics: Map<number, BasicCountStages>;
  constructor(domains: number[]) {
    this.total = new BasicCountStages();
    this.domainStatistics = new Map(
      domains.map((d) => [d, new BasicCountStages()])
    );
  }

  toObject() {
    return {
      total: this.total.toObject(),
      domainStatistics: Array.from(this.domainStatistics.entries()).map(
        ([d, v]) => [d, v.toObject()]
      ),
    };
  }
}

export class Statistics {
  counts: RootCountStagesStatistic;
  timings: RootTimingStatistic;
  constructor(domains: number[]) {
    this.counts = new RootCountStagesStatistic(domains);
    this.timings = new RootTimingStatistic(domains);
  }

  toObject() {
    return {
      counts: this.counts.toObject(),
      timings: this.timings.toObject(),
    };
  }

  forDomain(domain: number) {
    const counts = this.counts.domainStatistics.get(domain)!.toObject();
    const timings = this.timings.domainStatistics.get(domain)!.toObject();
    return {
      counts,
      timings,
    };
  }
}
