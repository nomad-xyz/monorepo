import { Gauge, Histogram, Counter } from 'prom-client';
import Logger from 'bunyan';

import { register } from 'prom-client';
import express, { Response } from 'express';
export const prefix = `nomad_indexer`;

export enum RpcRequestMethod {
  GetBlock = 'eth_getBlock',
  GetBlockWithTxs = 'eth_getBlockWithTransactions',
  GetTx = 'eth_getTransaction',
  GetTxReceipt = 'eth_getTransactionReceipt',
  GetBlockNumber = 'eth_getBlockNumber',
  GetLogs = 'eth_getLogs',
}

export enum DbRequestType {
  Select = 'select',
  Insert = 'insert',
  Update = 'update',
  Upsert = 'upsert',
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
  readonly logger: Logger;

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
  private numMessages: Gauge<string>;

  private homeFailedGauge: Gauge<string>;

  private latency: Histogram<string>;

  private gasUsage: Histogram<string>;

  private dbRequests: Counter<string>;
  private rpcRequests: Counter<string>;
  private rpcLatency: Histogram<string>;
  private rpcErrors: Counter<string>;

  private blocksToTipGauge: Gauge<string>;

  private events: Counter<string>;

  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    // Count

    this.numMessages = new Gauge({
      name: prefix + '_number_messages',
      help: 'Gauge that indicates how many messages are in dispatch, update, relay, receive or process stages',
      labelNames: ['stage', 'home', 'replica', 'environment'],
    });

    this.dbRequests = new Counter({
      name: prefix + '_db_requests',
      help: 'Count that indicates how many requests are coming to the db',
      labelNames: ['type', 'environment'],
    });

    this.rpcRequests = new Counter({
      name: prefix + '_rpc_requests',
      help: 'Count that indicates how many PRC requests are made',
      labelNames: ['method', 'home', 'environment'],
    });

    this.rpcLatency = new Histogram({
      name: prefix + '_rpc_latency',
      help: 'Histogram that tracks latency of how long does it take to make request in ms',
      labelNames: ['method', 'home', 'environment'],
      buckets,
    });

    this.rpcErrors = new Counter({
      name: prefix + '_rpc_errors',
      help: 'Counter that tracks error codes from RPC endpoint',
      labelNames: ['code', 'method', 'home', 'environment'],
    });

    // Time Histograms

    this.latency = new Histogram({
      name: prefix + '_latency',
      help: 'Histogram that tracks latency of how long does it take to move between dispatch, update, relay, receive or process stages in ms',
      labelNames: ['stage', 'home', 'replica', 'environment'],
      buckets,
    });

    // Gas

    this.gasUsage = new Histogram({
      name: prefix + '_gas_usage',
      help: 'Histogram that tracks gas usage in wei of a transaction that initiated at dispatch, update, relay, receive or process stages.',
      labelNames: ['stage', 'home', 'replica', 'environment'],
      buckets,
    });

    // Home Health

    this.homeFailedGauge = new Gauge({
      name: prefix + '_home_failed',
      help: 'Gauge that indicates if home of a network is in failed state.',
      labelNames: ['home', 'environment'],
    });

    // Blocks to tip

    this.blocksToTipGauge = new Gauge({
      name: prefix + '_blocks_to_tip',
      help: 'Gauge that indicates how many blocks to the tip is left to index.',
      labelNames: ['home', 'environment'],
    });

    this.events = new Counter({
      name: prefix + '_events',
      help: 'Counter that tracks amount of events successfully applied to messages during live run (not the initial feed ie. after restart)',
      labelNames: ['stage', 'home', 'replica', 'environment'],
    });
  }

  /**
   * Sets the state for a bridge.
   */
  setHomeState(home: string, homeFailed: boolean) {
    this.logger.info(`Reporting metric`, {metricName: 'homeFailedGauge'})
    this.homeFailedGauge.set(
      { home, environment: this.environment },
      homeFailed ? 1 : 0,
    );
  }

  incNumMessages(stage: string, home: string, replica: string) {
    this.logger.info(`Reporting metric`, {metricName: 'numMessages'})
    this.numMessages.labels(stage, home, replica, this.environment).inc();
  }
  decNumMessages(stage: string, home: string, replica: string) {
    this.logger.info(`Reporting metric`, {metricName: 'numMessages'})
    this.numMessages.labels(stage, home, replica, this.environment).dec();
  }
  setNumMessages(
    stage: string,
    home: string,
    replica: string,
    count: number,
  ) {
    this.logger.info(`Reporting metric`, {metricName: 'numMessages'})
    this.numMessages
      .labels(stage, home, replica, this.environment)
      .set(count);
  }

  observeLatency(stage: string, home: string, replica: string, ms: number) {
    this.logger.info(`Reporting metric`, {metricName: 'latency'})
    this.latency.labels(stage, home, replica, this.environment).observe(ms);
  }

  observeGasUsage(stage: string, home: string, replica: string, gas: number) {
    this.logger.info(`Reporting metric`, {metricName: 'gasUsage'})
    this.gasUsage.labels(stage, home, replica, this.environment).observe(gas);
  }

  observeBlocksToTip(home: string, count: number) {
    this.logger.info(`Reporting metric`, {metricName: 'blocksToTipGauge'})
    this.blocksToTipGauge.labels(home, this.environment).set(count);
  }

  incDbRequests(type: DbRequestType, req?: number) {
    this.logger.info(`Reporting metric`, {metricName: 'dbRequests'})
    this.dbRequests.labels(type, this.environment).inc(req);
  }

  incRpcRequests(method: RpcRequestMethod, home: string, req?: number) {
    this.logger.info(`Reporting metric`, {metricName: 'rpcRequests'})
    this.rpcRequests.labels(method, home, this.environment).inc(req);
  }

  observeRpcLatency(method: RpcRequestMethod, home: string, ms: number) {
    this.logger.info(`Reporting metric`, {metricName: 'rpcLatency'})
    this.rpcLatency.labels(method, home, this.environment).observe(ms);
  }

  incRpcErrors(method: RpcRequestMethod, home: string, code: string) {
    this.logger.info(`Reporting metric`, {metricName: 'rpcErrors'})
    this.rpcErrors.labels(code, method, home, this.environment).inc();
  }

  incEvents(stage: string, home: string, replica: string, count?: number) {
    this.logger.info(`Reporting metric`, {metricName: 'events'})
    this.events.labels(stage, home, replica, this.environment).inc(count);
  }
}
