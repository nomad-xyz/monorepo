import { Gauge, Histogram, Counter } from 'prom-client';
import Logger from 'bunyan';

import { Home } from '@nomad-xyz/contracts-core';
import { BridgeContext } from '@nomad-xyz/sdk-bridge';

import { register } from 'prom-client';
import express, { Response } from 'express';
export const prefix = `nomad_metrics`;

export enum GoldSkyQuery {
  QueryExample1 = 'queryexample1',
  QueryExample2 = 'queryexample2',
  // TODO: since tables are labeled by environment, we should use a
  // different set of queries between staging / production
  stagingProcessFailureEvents = `
    query StagingProcessFailureEvents {
      staging_process_failure_aggregate {
        nodes {
          amount
          asset
          _gs_chain
        }
      }
    }
  `,
  stagingRecoveryEvents = `
    query StagingRecoveryEvents {
      staging_recovery_aggregate {
        nodes {
          _gs_chain
          amount
          asset
        }
      }
    }
  `,
}

const buckets = [
  1 * 60, // 1 min
  5 * 60, // 5 min
  10 * 60, // 10 min
  20 * 60, // 20 min
  30 * 60, // 30 min
  60 * 60, // 1 hr
  120 * 60, // 2 hrs
  240 * 60, // 4 hrs
  480 * 60, // 8 hrs
  960 * 60, // 16 hrs
  1920 * 60, // 32 hrs
];

export class MetricsCollector {
  readonly environment: string;
  private readonly logger: Logger;

  constructor(environment: string, logger: Logger) {
    this.environment = environment;
    this.logger = logger;
  }

  /**
   * Starts a server that exposes metrics in the prometheus format
   */
  startServer(port: number) {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw Error(`Invalid PrometheusPort value: ${port}`);
    }
    const server = express();

    server.get('/metrics', async (_, res: Response) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });

    this.logger.info(
      {
        endpoint: `http://0.0.0.0:${port}/metrics`,
      },
      'Prometheus metrics exposed',
    );

    server.listen(port);
  }
}

export class IndexerCollector extends MetricsCollector {
  private metricsLatency: Histogram<string>;
  private numMessages: Gauge<string>;
  private homeFailedGauge: Gauge<string>;
  private goldskyRequests: Counter<string>;
  private goldskyLatency: Histogram<string>;
  private goldskyErrors: Counter<string>;

  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    this.numMessages = new Gauge({
      name: prefix + '_number_messages',
      help: 'Gauge that indicates how many messages are in dispatch, update, relay, receive or process stages',
      labelNames: ['stage', 'network', 'replica', 'environment'],
    });

    this.goldskyRequests = new Counter({
      name: prefix + '_goldsky_requests',
      help: 'Count that indicates how many Goldsky requests are made',
      labelNames: ['query', 'environment'],
    });

    this.goldskyLatency = new Histogram({
      name: prefix + '_goldsky_latency',
      help: 'Histogram that tracks latency of a Goldsky request in ms',
      labelNames: ['query', 'environment'],
      buckets,
    });

    this.goldskyErrors = new Counter({
      name: prefix + '_goldsky_errors',
      help: 'Counter that tracks error codes from Goldsky endpoint',
      labelNames: ['code', 'query', 'environment'],
    });

    this.metricsLatency = new Histogram({
      name: prefix + '_metrics_latency',
      help: 'Histogram that tracks latency of response to metrics request in ms',
      labelNames: ['environment'],
      buckets,
    });

    this.homeFailedGauge = new Gauge({
      name: prefix + '_home_failed',
      help: 'Gauge that indicates if home of a network is in failed state.',
      labelNames: ['network', 'environment'],
    });
  }

  /**
   * Sets the state for a bridge.
   */
  setHomeState(network: string, homeFailed: boolean) {
    this.homeFailedGauge.set(
      { network, environment: this.environment },
      homeFailed ? 1 : 0,
    );
  }

  incNumMessages(stage: string, network: string, replica: string) {
    this.numMessages.labels(stage, network, replica, this.environment).inc();
  }
  decNumMessages(stage: string, network: string, replica: string) {
    this.numMessages.labels(stage, network, replica, this.environment).dec();
  }
  setNumMessages(
    stage: string,
    network: string,
    replica: string,
    count: number,
  ) {
    this.numMessages
      .labels(stage, network, replica, this.environment)
      .set(count);
  }

  observeMetricsLatency(ms: number) {
    this.metricsLatency.labels(this.environment).observe(ms);
  }

  incGoldskyRequests(query: GoldSkyQuery, req?: number) {
    this.goldskyRequests.labels(query, this.environment).inc(req);
  }

  observeGoldskyLatency(query: GoldSkyQuery, ms: number) {
    this.goldskyLatency.labels(query, this.environment).observe(ms);
  }

  incGoldskyErrors(query: GoldSkyQuery, code: string) {
    this.goldskyErrors.labels(code, query, this.environment).inc();
  }
}

export class HomeStatusCollector {
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
