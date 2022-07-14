import { Home } from '@nomad-xyz/contracts-core';
import { NomadMessage } from './consumerV2';
import { BridgeContext } from '@nomad-xyz/sdk-bridge';
import Logger from 'bunyan';
import { Consumer } from './consumer';
import { DB } from './db';
import { eventTypeToOrder, NomadishEvent } from './event';
import { Indexer } from './indexer';
import { IndexerCollector } from './metrics';
import { RedisClient, state2str } from './types';
import { sleep } from './utils';
import { nodeEnv } from '../config';

interface TbdPackage {
  ts: Date;
  domain: number;
  error: Error;
}
class OrchestratorError extends Error {
  errors: TbdPackage[];

  constructor(msg: string, errors: TbdPackage[]) {
    super(msg);
    this.errors = errors;
  }
}

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
    this.forbiddenDomains = []; // 2019844457
  }

  async init(): Promise<void> {
    await this.collectStatistics();
    await this.initIndexers();
    await this.initHealthCheckers();
    await this.initalFeedConsumer();
    try {
      if (nodeEnv === 'spooky things') {
        await this.checkAllIntegrity();
      }
    } catch (e) {
      this.logger.error(`Initial integrity failed:`, e);
      throw e;
    }
  }

  get allowedDomains(): number[] {
    return this.sdk.domainNumbers.filter(
      (domain) => !this.forbiddenDomains.includes(domain),
    );
  }

  async checkAllIntegrity(): Promise<void> {
    this.logger.debug(`Started integrity test for all domains`);
    await Promise.all(
      this.allowedDomains.map(async (domain: number) => {
        const indexer = this.indexers.get(domain)!;
        if (indexer.wantDummyStuff) {
          try {
            await indexer.dummyTestEventsIntegrity();
          } catch (e) {
            this.logger.warn(`Integrity test for domain ${domain} failed`);
            indexer.setForceFrom(indexer.deployHeight);
          }
        }
      }),
    );
    this.logger.debug(`Finished integrity test for all domains`);
  }

  async indexAllUnrelated(): Promise<void> {
    const finished = false;
    const errors: TbdPackage[] = [];

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
            `Received ${eventsForDomain.length} events after reindexing for domain ${domain}`,
          );
          await this.consumer.consume(eventsForDomain);
          await this.checkHealth(domain);

          if (eventsForDomain.length) await this.collectStatistics();
          this.reportAllMetrics();
        } catch (e: any) {
          this.logger.error(`Error at Indexing ${domain}`, e);
          await sleep(5000);
          errors.push({ domain, ts: new Date(), error: e });
          if (errors.length >= this.allowedDomains.length * 5) {
            throw new OrchestratorError(
              `Too many errors in indexer(s)`,
              errors,
            );
          }
        }
      }
    });
    await Promise.all(promises);

    return;
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
    this.logger.info(`Started collecting statistics`);

    const stats = await this.db.getMessageStats();
    this.logger.info(`Statistics acquired`);

    stats.forEach((stat) => {
      const { origin, destination, state, count } = stat;

      const stageStr = state2str[state];
      try {
        const originStr = this.sdk.getDomain(origin)?.name;
        const destinationStr = this.sdk.getDomain(destination)?.name;

        if (destinationStr && originStr) {
          this.metrics.setNumMessages(stageStr, originStr, destinationStr, count);
        }
      } catch(_) {

      }
    });

    this.logger.info(`Fed statistics to metrics`);
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
    this.logger.info(`Started initial feed consumer`);
    const events = (
      await Promise.all(
        Array.from(this.indexers.values()).map((indexer) =>
          indexer.persistance.allEvents(),
        ),
      )
    ).flat();

    this.logger.info(`Initial feed contains: ${events.length} events`);

    events.sort((a, b) => {
      if (a.ts === b.ts) {
        return eventTypeToOrder(a) - eventTypeToOrder(b);
      } else {
        return a.ts - b.ts;
      }
    });
    this.logger.info(`Started actual consumption`);
    await this.consumer.consume(events);
    this.logger.info(`Finished consumption of ${events.length}`);
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
        const g = e.gasUsed.toNumber();
        if (g)
          this.metrics.observeGasUsage('dispatched', homeName, replicaName, g);
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });

    this.consumer.on('updated', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        const t = m.timings.toUpdate();
        const g = e.gasUsed.toNumber();
        if (t) {
          this.metrics.observeLatency('updated', homeName, replicaName, t);
          if (t < 0) {
            this.logger.warn(
              {
                origin: m.origin,
                destination: m.destination,
                stage: 'updated',
                value: t,
              },
              `Replorted timings is below zero`,
            );
          }
        }
        if (g)
          this.metrics.observeGasUsage('updated', homeName, replicaName, g);
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });

    this.consumer.on('relayed', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        const t = m.timings.toRelay();
        const g = e.gasUsed.toNumber();
        if (t) {
          this.metrics.observeLatency('relayed', homeName, replicaName, t);
          if (t < 0) {
            this.logger.warn(
              {
                origin: m.origin,
                destination: m.destination,
                stage: 'relayed',
                value: t,
              },
              `Replorted timings is below zero`,
            );
          }
        }
        if (g)
          this.metrics.observeGasUsage('relayed', homeName, replicaName, g);
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });

    this.consumer.on('received', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        const t = m.timings.toReceive();
        const g = e.gasUsed.toNumber();
        if (t) {
          this.metrics.observeLatency('received', homeName, replicaName, t);
          if (t < 0) {
            this.logger.warn(
              {
                origin: m.origin,
                destination: m.destination,
                stage: 'received',
                value: t,
              },
              `Replorted timings is below zero`,
            );
          }
        }
        if (g)
          this.metrics.observeGasUsage('received', homeName, replicaName, g);
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });

    this.consumer.on('processed', (m: NomadMessage, e: NomadishEvent) => {
      try {
        const homeName = this.domain2name(m.origin);
        const replicaName = this.domain2name(m.destination);
        const t = m.timings.toProcess();
        const e2e = m.timings.toE2E();
        const g = e.gasUsed.toNumber();
        if (t) {
          this.metrics.observeLatency('processed', homeName, replicaName, t);
          if (t < 0) {
            this.logger.warn(
              {
                origin: m.origin,
                destination: m.destination,
                stage: 'processed',
                value: t,
              },
              `Replorted timings is below zero`,
            );
          }
        }
        if (e2e) {
          this.metrics.observeLatency('e2e', homeName, replicaName, e2e);
        }
        if (g)
          this.metrics.observeGasUsage('processed', homeName, replicaName, g);
      } catch (e) {
        this.logger.error(`Domain ${m.origin} or ${m.destination} not found`);
      }
    });
  }

  async consumeUnrelated() {
    this.logger.info(`Started to index`);
    const start = new Date().valueOf();
    try {
      await this.indexAllUnrelated();
    } catch (e) {
      if (e instanceof OrchestratorError) {
        // TODO: something with it
        this.logger.error(
          `Orchestrator cought many indexer's errors:`,
          e.errors,
        );
      }
      this.logger.error(`Some error cought:`, e);

      process.exit(1);
    }

    this.logger.info(
      `Finished reindexing after ${
        (new Date().valueOf() - start) / 1000
      } seconds`,
    );
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
