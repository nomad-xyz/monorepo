import { Home } from "@nomad-xyz/contracts-core";
import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import Logger from "bunyan";
import { Consumer } from "./consumer";
import { DB } from "./db";
import { eventTypeToOrder } from "./event";
import { Indexer } from "./indexer";
import { IndexerCollector } from "./metrics";
import { Statistics } from "./types";
import { replacer, sleep } from "./utils";

class HomeHealth {
  home: Home;
  domain: number;
  logger: Logger;
  metrics: IndexerCollector;

  constructor(
    domain: number,
    ctx: BridgeContext,
    logger: Logger,
    metrics: IndexerCollector
  ) {
    this.domain = domain;
    this.home = ctx.mustGetCore(domain).home;
    this.logger = logger;
    this.metrics = metrics;
  }

  async healthy(): Promise<boolean> {
    try {
      const state = await this.home.state();
      if (state !== 1) {
        return false;
      } else {
        return true;
      }
    } catch (e: any) {
      this.logger.warn(
        `Couldn't collect home state for ${this.domain} domain. Error: ${e.message}`
      );
      // TODO! something
    }
    return true; // BAD!!!
  }

  get failed(): boolean {
    return !this.healthy;
  }
}

export class Orchestrator {
  sdk: BridgeContext;
  consumer: Consumer;
  indexers: Map<number, Indexer>;
  healthCheckers: Map<number, HomeHealth>;
  gov: number;
  done: boolean;
  chaseMode: boolean;
  metrics: IndexerCollector;
  logger: Logger;
  db: DB;

  constructor(
    sdk: BridgeContext,
    c: Consumer,
    metrics: IndexerCollector,
    logger: Logger,
    db: DB
  ) {
    this.sdk = sdk;
    this.consumer = c;
    this.indexers = new Map();
    this.healthCheckers = new Map();
    this.gov = sdk.governor.domain;
    this.done = false;
    this.chaseMode = true;
    this.metrics = metrics;
    this.logger = logger;
    this.db = db;
  }

  async init() {
    await this.initIndexers();
    await this.initHealthCheckers();
    await this.initalFeedConsumer();
    // console.log(`Checking integrity`);
    try {
      await this.checkAllIntegrity();
    } catch(e) {
      this.logger.error(`Initial integrity failed:`, e);
      throw e;
    }
    // console.log(`Checked integrity`);
    
    // console.log(`EXITING!`);
    // process.exit(0);
  }

  async checkAllIntegrity(): Promise<void> {

    await Promise.all(this.sdk.domainNumbers.map(async (domain: number) => {
      let indexer = this.indexers.get(domain)!;
      await indexer.dummyTestEventsIntegrity()
    }))

    
    // const events = (
    //   await Promise.all(
    //     this.sdk.domainNumbers.map((domain: number) => this.index(domain))
    //   )
    // ).flat();
    // events.sort((a, b) => {
    //   if (a.ts === b.ts) {
    //     return eventTypeToOrder(a) - eventTypeToOrder(b) 
    //   } else {
    //     return a.ts - b.ts
    //   }
    // });
    // this.logger.info(`Received ${events.length} events after reindexing`);
    // await this.consumer.consume(events);
    // return events.length;
  }

  async indexAll(): Promise<number> {
    const events = (
      await Promise.all(
        this.sdk.domainNumbers.map((domain: number) => this.index(domain))
      )
    ).flat();
    events.sort((a, b) => {
      if (a.ts === b.ts) {
        return eventTypeToOrder(a) - eventTypeToOrder(b) 
      } else {
        return a.ts - b.ts
      }
    });
    this.logger.info(`Received ${events.length} events after reindexing`);
    await this.consumer.consume(events);
    return events.length;
  }

  async index(domain: number) {
    let indexer = this.indexers.get(domain)!;

    let replicas = [];
    if (domain === this.gov) {
      replicas = this.sdk.domainNumbers.filter((d) => d != this.gov);
    } else {
      replicas = [this.gov];
    }

    return await indexer.updateAll(replicas);
  }

  collectStatistics() {
    const stats = this.consumer.stats();

    this.sdk.domainNumbers.forEach(async (domain: number) => {
      const network = this.domain2name(domain);
      try {
        const s = stats.forDomain(domain).counts;
        this.metrics.setNumMessages("dispatched", network, s.dispatched);
        this.metrics.setNumMessages("updated", network, s.updated);
        this.metrics.setNumMessages("relayed", network, s.relayed);
        this.metrics.setNumMessages("received", network, s.received);
        this.metrics.setNumMessages("processed", network, s.processed);
      } catch (e: any) {
        this.logger.error(
          `Tried to collect statistics for domain ${domain}, but error happened: ${e.message}`
        );
      }
    });
  }

  async checkAllHealth() {
    await Promise.all(
      this.sdk.domainNumbers.map(async (domain: number) => {
        await this.checkHealth(domain);
      })
    );
  }

  async checkHealth(domain: number) {
    this.metrics.setHomeState(
      this.domain2name(domain),
      (await this.healthCheckers.get(domain)!.healthy()) !== true
    );
  }

  async initalFeedConsumer() {
    const events = (
      await Promise.all(
        Array.from(this.indexers.values()).map((indexer) =>
          indexer.persistance.allEvents()
        )
      )
    ).flat();
    events.sort((a, b) => {
      if (a.ts === b.ts) {
        return eventTypeToOrder(a) - eventTypeToOrder(b) 
      } else {
        return a.ts - b.ts
      }
    });
    await this.consumer.consume(events);
  }

  async initIndexers() {
    for (const domain of this.sdk.domainNumbers) {
      const indexer = new Indexer(domain, this.sdk, this);
      await indexer.init();
      this.indexers.set(domain, indexer);
    }
  }

  async initHealthCheckers() {
    for (const domain of this.sdk.domainNumbers) {
      const checker = new HomeHealth(
        domain,
        this.sdk,
        this.logger,
        this.metrics
      );
      this.healthCheckers.set(domain, checker);
    }
  }

  subscribeStatisticEvents() {
    this.consumer.on(
      "dispatched",
      (home: number, replica: number, gas: number) => {
        const homeName = this.domain2name(home);
        const replicaName = this.domain2name(replica);
        this.metrics.observeGasUsage("dispatched", homeName, replicaName, gas);
      }
    );

    this.consumer.on(
      "updated",
      (home: number, replica: number, ms: number, gas: number) => {
        const homeName = this.domain2name(home);
        const replicaName = this.domain2name(replica);
        this.metrics.observeLatency("updated", homeName, replicaName, ms);
        this.metrics.observeGasUsage("updated", homeName, replicaName, gas);
      }
    );

    this.consumer.on(
      "relayed",
      (home: number, replica: number, ms: number, gas: number) => {
        const homeName = this.domain2name(home);
        const replicaName = this.domain2name(replica);
        this.metrics.observeLatency("relayed", homeName, replicaName, ms);
        this.metrics.observeGasUsage("relayed", homeName, replicaName, gas);
      }
    );

    this.consumer.on(
      "received",
      (home: number, replica: number, ms: number, gas: number) => {
        const homeName = this.domain2name(home);
        const replicaName = this.domain2name(replica);
        this.metrics.observeLatency("received", homeName, replicaName, ms);
        this.metrics.observeGasUsage("received", homeName, replicaName, gas);
      }
    );

    this.consumer.on(
      "processed",
      (home: number, replica: number, e2e: number, gas: number) => {
        const homeName = this.domain2name(home);
        const replicaName = this.domain2name(replica);
        this.metrics.observeLatency("processed", homeName, replicaName, e2e);
        this.metrics.observeGasUsage("processed", homeName, replicaName, gas);
      }
    );
  }

  async startConsuming() {
    while (!this.done) {
      this.logger.info(`Started to reindex`);
      const start = new Date().valueOf();
      const eventsLength = await this.indexAll();
      await this.checkAllHealth();

      if (eventsLength > 0) this.collectStatistics();

      if (this.chaseMode) {
        this.chaseMode = false;
        this.subscribeStatisticEvents();
      }

      this.logger.info(
        `Finished reindexing after ${
          (new Date().valueOf() - start) / 1000
        } seconds`
      );

      this.reportAllMetrics();

      await sleep(5000);
    }
  }

  reportAllMetrics() {
    for (const domain of this.sdk.domainNumbers) {
      const network = this.domain2name(domain);
      this.metrics.setHomeState(
        network,
        this.healthCheckers.get(domain)!.failed
      );
    }
  }

  domain2name(domain: number): string {
    return this.sdk.getDomain(domain)!.name;
  }

  stop() {
    this.done = true;
  }
}
