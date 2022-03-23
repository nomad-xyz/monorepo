import { Gauge, Histogram, Counter } from "prom-client";
import Logger from "bunyan";

import { register } from "prom-client";
import express, { Response } from "express";
export const prefix = `nomad_indexer`;


export enum RpcRequestMethod {
  GetBlock = 'eth_getBlock',
  GetBlockWithTxs = 'eth_getBlockWithTransactions',
  GetTx = 'eth_getTransaction',
  GetTxReceipt = 'eth_getTransactionReceipt',
  GetBlockNumber = 'eth_getBlockNumber',
  GetLogs = 'eth_getLogs',
};

export enum DbRequestType {
  Select = 'select',
  Insert = 'insert',
  Update = 'update',
  Upsert = 'upsert',
};

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

    server.get("/metrics", async (_, res: Response) => {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    });

    this.logger.info(
      {
        endpoint: `http://0.0.0.0:${port}/metrics`,
      },
      "Prometheus metrics exposed"
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
  





  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    // Count

    this.numMessages = new Gauge({
      name: prefix + "_number_messages",
      help: "Gauge that indicates how many messages are in dispatch, update, relay, receive or process stages",
      labelNames: ["stage", "network", "environment"],
    });

    this.dbRequests = new Counter({
      name: prefix + "_db_requests",
      help: "Count that indicates how many requests are coming to the db",
      labelNames: ["type", "environment"],
    });

    this.rpcRequests = new Counter({
      name: prefix + "_rpc_requests",
      help: "Count that indicates how many PRC requests are made",
      labelNames: ["method", "network", "environment"],
    });

    this.rpcLatency = new Histogram({
      name: prefix + "_rpc_latency",
      help: "Histogram that tracks latency of how long does it take to make request in ms",
      labelNames: ["method", "network", "environment"],
      buckets,
    });

    this.rpcErrors = new Counter({
      name: prefix + "_rpc_errors",
      help: "Counter that tracks error codes from RPC endpoint",
      labelNames: ["code", "method", "network", "environment"],
    });

    

    // Time Histograms

    this.latency = new Histogram({
      name: prefix + "_latency",
      help: "Histogram that tracks latency of how long does it take to move between dispatch, update, relay, receive or process stages in ms",
      labelNames: ["stage", "home", "replica", "environment"],
      buckets,
    });

    // Gas

    this.gasUsage = new Histogram({
      name: prefix + "_gas_usage",
      help: "Histogram that tracks gas usage in wei of a transaction that initiated at dispatch, update, relay, receive or process stages.",
      labelNames: ["stage", "home", "replica", "environment"],
      buckets,
    });

    // Home Health

    this.homeFailedGauge = new Gauge({
      name: "nomad_monitor_home_failed",
      help: "Gauge that indicates if home of a network is in failed state.",
      labelNames: ["network", "environment"],
    });
  }

  /**
   * Sets the state for a bridge.
   */
  setHomeState(
    network: string,
    homeFailed: boolean
  ) {
    this.homeFailedGauge.set(
      { network, environment: this.environment },
      homeFailed ? 1 : 0
    );
  }

  

  incNumMessages(stage: string, network: string) {
    this.numMessages.labels(stage, network, this.environment).inc()
  }
  decNumMessages(stage: string, network: string) {
    this.numMessages.labels(stage, network, this.environment).dec()
  }
  setNumMessages(stage: string, network: string, count: number) {
    this.numMessages.labels(stage, network, this.environment).set(count)
  }

  observeLatency(stage: string, home: string, replica: string, ms: number) {
    this.latency.labels(stage, home, replica, this.environment).observe(ms)
  }

  observeGasUsage(stage: string, home: string, replica: string, gas: number) {
    this.gasUsage.labels(stage, home, replica, this.environment).observe(gas)
  }

  incDbRequests(type: DbRequestType, req?: number) {
    this.dbRequests.labels(type, this.environment).inc(req)
  }

  incRpcRequests(method: RpcRequestMethod, network: string, req?: number) {
    this.rpcRequests.labels(method, network, this.environment).inc(req)
  }

  observeRpcLatency(method: RpcRequestMethod, network: string, ms: number) {
    this.rpcLatency.labels(method, network, this.environment).observe(ms)
  }

  incRpcErrors(method: RpcRequestMethod, network: string, code: string) {
    this.rpcErrors.labels(code, method, network, this.environment).inc()
  }
}
