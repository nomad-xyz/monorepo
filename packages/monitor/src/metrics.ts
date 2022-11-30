import { Gauge, Histogram, Counter } from 'prom-client';
import Logger from 'bunyan';
import { register } from 'prom-client';
import express, { Response } from 'express';
export const prefix = `nomad_metrics`;

export enum MessageStages {
  Dispatched = 'dispatched',
  Updated = 'updated',
  Relayed = 'relayed',
  Processed = 'processed',
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
  startServer(port: number): void {
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

export class MonitoringCollector extends MetricsCollector {
  private metricsLatency: Histogram<string>;
  private numMessages: Gauge<string>;
  private homeFailedGauge: Gauge<string>;
  // private goldskyRequests: Counter<string>;
  // private goldskyLatency: Histogram<string>;
  // private goldskyErrors: Counter<string>;
  private numProcessFailureEvents: Counter<string>;
  private numRecoveryEvents: Counter<string>;
  private requests: Histogram<string>;
  private requestErrors: Counter<string>;

  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    this.numMessages = new Gauge({
      name: prefix + '_number_messages',
      help: 'Gauge that indicates how many messages are in dispatch, update, relay, receive or process stages',
      labelNames: ['stage', 'network', 'replica', 'environment'],
    });

    // this.goldskyRequests = new Counter({
    //   name: prefix + '_goldsky_requests',
    //   help: 'Count that indicates how many Goldsky requests are made',
    //   labelNames: ['query', 'environment'],
    // });

    // this.goldskyLatency = new Histogram({
    //   name: prefix + '_goldsky_latency',
    //   help: 'Histogram that tracks latency of a Goldsky request in ms',
    //   labelNames: ['query', 'environment'],
    //   buckets,
    // });

    // this.goldskyErrors = new Counter({
    //   name: prefix + '_goldsky_errors',
    //   help: 'Counter that tracks error codes from Goldsky endpoint',
    //   labelNames: ['code', 'query', 'environment'],
    // });



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

    // NFT related metrics

    this.numProcessFailureEvents = new Counter({
      name: prefix + '_num_process_failure_events',
      help: 'Counter that tracks the number of process failure events. This event is emitted when tokens would have been transferred, but the asset was in the affected assets list.',
      labelNames: ['asset', 'environment'],
    });

    this.numRecoveryEvents = new Counter({
      name: prefix + '_num_recovery_events',
      help: 'Counter that tracks the number of recovery events. This event is emitted when an NFT is used to access funds.',
      labelNames: ['asset', 'environment'],
    });

    this.requests = new Histogram({
      name: prefix + '_requests',
      help: 'Histogram that tracks latency of response to metrics request in ms',
      labelNames: ['service', 'query', 'labels', 'environment'],
      buckets,
    });

    this.requestErrors = new Counter({
      name: prefix + '_request_errors',
      help: 'Histogram that tracks latency of response to metrics request in ms',
      labelNames: ['service', 'query', 'labels', 'environment'],
    });

  }

  /**
   * Sets the state for a bridge.
   */
  setHomeState(network: string, homeFailed: boolean): void {
    this.homeFailedGauge.set(
      { network, environment: this.environment },
      homeFailed ? 1 : 0,
    );
  }

  incNumMessages(stage: MessageStages, network: string, replica: string): void {
    this.numMessages.labels(stage, network, replica, this.environment).inc();
  }
  decNumMessages(stage: MessageStages, network: string, replica: string): void {
    this.numMessages.labels(stage, network, replica, this.environment).dec();
  }
  setNumMessages(
    stage: MessageStages,
    network: string,
    replica: string,
    count: number,
  ): void {
    this.numMessages
      .labels(stage, network, replica, this.environment)
      .set(count);
  }

  observeMetricsLatency(ms: number): void {
    this.metricsLatency.labels(this.environment).observe(ms);
  }

  incNumProcessFailureEvents(asset: string, environment: string): void {
    this.numProcessFailureEvents.labels(asset, environment).inc();
  }

  incNumRecoveryEvents(asset: string, environment: string): void {
    this.numRecoveryEvents.labels(asset, environment).inc();
  }

  // incGoldskyRequests(query: GoldSkyQuery, req?: number): void {
  //   this.goldskyRequests.labels(query, this.environment).inc(req);
  // }

  // observeGoldskyLatency(query: GoldSkyQuery, ms: number): void {
  //   this.goldskyLatency.labels(query, this.environment).observe(ms);
  // }

  // incGoldskyErrors(query: GoldSkyQuery, code: string): void {
  //   this.goldskyErrors.labels(code, query, this.environment).inc();
  // }

  // observeRPCLatency(query: string, provider: string, ms: number): void {
  //   this.rpcLatency.labels(query, this.environment).observe(ms);
  // }

  // incRPCErrors(query: string, provider: string, code: string): void {
  //   this.rpcErrors.labels(code, query, this.environment).inc();
  // }

  async recordRequest<T>(request: Promise<T>, service: string, requestName: string, ...labels: string[]): Promise<T | undefined> {
    const start = Date.now();
    let result: T;
    try {
      result = await request;
      const duration = Date.now() - start;
      this.requests.labels(service, requestName, ...labels, this.environment).observe(duration);
      return result;
    } catch(e) {
      this.requestErrors.labels(service, requestName, ...labels, this.environment).inc();
      // throw e;
    }
    
    
    return undefined;
  }
}
// TODO: might want to just copy the MetricsCollector from here:
// https://github.com/nomad-xyz/monorepo/blob/d5b7d05190bc2493e17742fc65f032b5e94be78e/packages/indexer/src/core/metrics.ts
