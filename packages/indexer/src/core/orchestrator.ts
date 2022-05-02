import { Home } from '@nomad-xyz/contracts-core';
import { NomadMessage } from './consumerV2';
import { BridgeContext } from '@nomad-xyz/sdk-bridge';
import Logger from 'bunyan';
import { Consumer } from './consumer';
import { DB } from './db';
import { eventTypeToOrder, NomadishEvent } from './event';
import { Indexer } from './indexer';
import { IndexerCollector } from './metrics';
import { RedisClient } from './types';
import { sleep } from './utils';

class HomeHealth {
  home: Home;
  domain: number;
  logger: Logger;
  metrics: IndexerCollector;

  constructor(
    domain: number,
    ctx: BridgeContext,
    logger: Logger,
    metrics: IndexerCollector,
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
        `Couldn't collect home state for ${this.domain} domain. Error: ${e.message}`,
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
  redis?: RedisClient;
  forbiddenDomains: number[];

  constructor(
    sdk: BridgeContext,
    c: Consumer,
    metrics: IndexerCollector,
    logger: Logger,
    db: DB,
    redis?: RedisClient,
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
    this.redis = redis;
    this.forbiddenDomains = [2019844457];
  }

  async init() {
    await this.initIndexers();
    await this.initHealthCheckers();
    await this.initalFeedConsumer();
    try {
      await this.checkAllIntegrity();
    } catch (e) {
      this.logger.error(`Initial integrity failed:`, e);
      throw e;
    }
    await this.collectStatistics();
  }

  get allowedDomains(): number[] {
    return this.sdk.domainNumbers.filter(
      (domain) => !this.forbiddenDomains.includes(domain),
    );
  }

  async checkAllIntegrity(): Promise<void> {
    await Promise.all(
      this.allowedDomains.map(async (domain: number) => {
        const indexer = this.indexers.get(domain)!;
        await indexer.dummyTestEventsIntegrity();
      }),
    );
  }

  async indexAllUnrelated(): Promise<[number, Date, any][]> {
    let finished = false;
    const errors: [number, Date, any][] = [];

    const promises = this.allowedDomains.map(async (domain: number) => {
      while (!finished) {
        try {
          const eventsForDomain = await this.index(domain);

          eventsForDomain.sort((a, b) => {
            if (a.ts === b.ts) {
              return eventTypeToOrder(a) - eventTypeToOrder(b);
            } else {
              return a.ts - b.ts;
            }
          });

          this.logger.info(
            `Received ${eventsForDomain.length} events after reindexing for domain: ${domain}`,
          );
          await this.consumer.consume(eventsForDomain);
          await this.checkHealth(domain);

          if (eventsForDomain.length) await this.collectStatistics();
          this.reportAllMetrics();

          // await sleep(5000);
        } catch (e) {
          this.logger.error(`Error at Indexing ${domain}`, e);
          await sleep(5000);
          errors.push([domain, new Date(), e]);
          if (errors.length >= 100) {
            finished = true;
          }
          // finished = true;
        }
      }
    });

    // return errors;

    // const events = (
    //   await Promise.all(
    //     this.sdk.domainNumbers.map((domain: number) => this.index(domain)),
    //   )
    // ).flat();
    // events.sort((a, b) => {
    //   if (a.ts === b.ts) {
    //     return eventTypeToOrder(a) - eventTypeToOrder(b);
    //   } else {
    //     return a.ts - b.ts;
    //   }
    // });
    // this.logger.info(`Received ${events.length} events after reindexing`);
    // await this.consumer.consume(events);
    await Promise.all(promises);

    return errors;
  }

  async indexAllRelated(): Promise<number> {
    const events = (
      await Promise.all(
        this.allowedDomains.map((domain: number) => this.index(domain)),
      )
    ).flat();
    events.sort((a, b) => {
      if (a.ts === b.ts) {
        return eventTypeToOrder(a) - eventTypeToOrder(b);
      } else {
        return a.ts - b.ts;
      }
    });
    this.logger.info(`Received ${events.length} events after reindexing`);
    await this.consumer.consume(events);
    return events.length;
  }

  async index(domain: number) {
    const indexer = this.indexers.get(domain)!;

    let replicas = [];
    if (domain === this.gov) {
      replicas = this.allowedDomains.filter((d) => d != this.gov);
    } else {
      replicas = [this.gov];
    }

    return await indexer.updateAll(replicas);
  }

  async collectStatistics() {
    const stats = await this.consumer.stats();

    this.allowedDomains.forEach(async (domain: number) => {
      const network = this.domain2name(domain);
      try {
        const s = stats.forDomain(domain).counts;
        this.metrics.setNumMessages('dispatched', network, s.dispatched);
        this.metrics.setNumMessages('updated', network, s.updated);
        this.metrics.setNumMessages('relayed', network, s.relayed);
        this.metrics.setNumMessages('received', network, s.received);
        this.metrics.setNumMessages('processed', network, s.processed);
      } catch (e: any) {
        this.logger.error(
          `Tried to collect statistics for domain ${domain}, but error happened: ${e.message}`,
        );
      }
    });
  }

  async checkAllHealth() {
    await Promise.all(
      this.allowedDomains.map(async (domain: number) => {
        await this.checkHealth(domain);
      }),
    );
  }

  async checkHealth(domain: number) {
    this.metrics.setHomeState(
      this.domain2name(domain),
      (await this.healthCheckers.get(domain)!.healthy()) !== true,
    );
  }

  async initalFeedConsumer() {
    const events = (
      await Promise.all(
        Array.from(this.indexers.values()).map((indexer) =>
          indexer.persistance.allEvents(),
        ),
      )
    ).flat();
    events.sort((a, b) => {
      if (a.ts === b.ts) {
        return eventTypeToOrder(a) - eventTypeToOrder(b);
      } else {
        return a.ts - b.ts;
      }
    });
    await this.consumer.consume(events);
  }

  async initIndexers() {
    for (const domain of this.allowedDomains) {
      const indexer = new Indexer(domain, this.sdk, this, this.redis);
      await indexer.init();
      this.indexers.set(domain, indexer);
    }
  }

  async initHealthCheckers() {
    for (const domain of this.allowedDomains) {
      const checker = new HomeHealth(
        domain,
        this.sdk,
        this.logger,
        this.metrics,
      );
      this.healthCheckers.set(domain, checker);
    }
  }

  subscribeStatisticEvents() {
    this.consumer.on('dispatched', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        this.metrics.observeGasUsage(
          'dispatched',
          homeName,
          replicaName,
          e.gasUsed.toNumber(),
        );
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });

    this.consumer.on('updated', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        this.metrics.observeLatency(
          'updated',
          homeName,
          replicaName,
          m.timings.toUpdate()!,
        );
        this.metrics.observeGasUsage(
          'updated',
          homeName,
          replicaName,
          e.gasUsed.toNumber(),
        );
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });

    this.consumer.on('relayed', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        this.metrics.observeLatency(
          'relayed',
          homeName,
          replicaName,
          m.timings.toRelay()!,
        );
        this.metrics.observeGasUsage(
          'relayed',
          homeName,
          replicaName,
          e.gasUsed.toNumber(),
        );
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });

    this.consumer.on('received', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        this.metrics.observeLatency(
          'received',
          homeName,
          replicaName,
          m.timings.toReceive()!,
        );
        this.metrics.observeGasUsage(
          'received',
          homeName,
          replicaName,
          e.gasUsed.toNumber(),
        );
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });

    this.consumer.on('processed', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        this.metrics.observeLatency(
          'processed',
          homeName,
          replicaName,
          m.timings.toProcess()!,
        );
        this.metrics.observeGasUsage(
          'processed',
          homeName,
          replicaName,
          e.gasUsed.toNumber(),
        );
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });
  }

  async consumeUnrelated() {
    this.logger.info(`Started to index`);
    const start = new Date().valueOf();
    const errors = await this.indexAllUnrelated();
    this.logger.info(
      `Finished reindexing after ${
        (new Date().valueOf() - start) / 1000
      } seconds`,
    );

    if (errors.length > 0) {
      this.logger.error(`Collected errors in multiple indexers:`, errors);
      process.exit(1);
    }

    process.exit(0);
  }

  async consumeRelated() {
    while (!this.done) {
      this.logger.info(`Started to reindex`);
      const start = new Date().valueOf();
      const eventsLength = await this.indexAllRelated();
      await this.checkAllHealth();

      if (eventsLength > 0) await this.collectStatistics();

      if (this.chaseMode) {
        this.chaseMode = false;
        // this.subscribeStatisticEvents();
      }

      this.logger.info(
        `Finished reindexing after ${
          (new Date().valueOf() - start) / 1000
        } seconds`,
      );

      this.reportAllMetrics();

      await sleep(5000);
    }
  }

  async startConsuming() {
    await this.consumeUnrelated();
    // await this.consumeRelated();
  }

  reportAllMetrics() {
    for (const domain of this.allowedDomains) {
      const network = this.domain2name(domain);
      this.metrics.setHomeState(
        network,
        this.healthCheckers.get(domain)!.failed,
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
