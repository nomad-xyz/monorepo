import { Gauge, Histogram, Counter } from "prom-client";
import Logger from "bunyan";

import { register } from "prom-client";
import express, { Response } from "express";
export const prefix = `nomad_keymaster`;

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
  private readonly logger: Logger;

  constructor(logger: Logger) {
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

    server.get("/metrics", async (_: unknown, res: Response) => {
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

export class BaseMetricsCollector extends MetricsCollector {
  gasUsed: Counter<string>;
  rpcRequests: Counter<string>;
  rpcErrors: Counter<string>;
  rpcLatency: Histogram<string>;
  malfunctions: Counter<string>;

  constructor(logger: Logger) {
    super(logger);

    const labelNames = ["home"];

    this.rpcRequests = new Counter({
      name: prefix + "_rpc_requests",
      help: "Count that indicates how many PRC requests are made",
      labelNames: [...labelNames, "method"],
    });

    this.rpcLatency = new Histogram({
      name: prefix + "_rpc_latency",
      help: "Histogram that tracks latency of how long does it take to make request in ms",
      labelNames: [...labelNames, "method"],
      buckets,
    });

    this.rpcErrors = new Counter({
      name: prefix + "_rpc_errors",
      help: "Counter that tracks error codes from RPC endpoint",
      labelNames: [...labelNames, "method", "code"],
    });

    this.gasUsed = new Counter({
      name: prefix + "_gas_used",
      help: "Histogram that tracks gas usage in wei of a transaction that initiated at dispatch, update, relay, receive or process stages.",
      labelNames: [...labelNames, "method"],
    });

    this.malfunctions = new Counter({
      name: prefix + "_malfunctions",
      help: "Counter that tracks unrecoverable malfunctions in a network.",
      labelNames: [...labelNames, "scope"],
    });
  }

  observeLatency(home: string, method: string, ms: number) {
    this.rpcLatency.labels(home, method).observe(ms);
  }

  incRpcRequests(home: string, method: string) {
    this.rpcRequests.labels(home, method).inc();
  }

  incRpcErrors(home: string, method: string, code: string) {
    this.rpcErrors.labels(home, method, code).inc();
  }

  incGasUsed(home: string, method: string, amount: number) {
    this.gasUsed.labels(home, method).inc(amount);
  }

  incMalfunctions(home: string, scope: string) {
    this.malfunctions.labels(home, scope).inc();
  }
}

export class AccountMetricsCollector extends BaseMetricsCollector {
  // balance
  private balance: Gauge<string>;
  // transfers
  private transfers: Counter<string>;
  // transferred
  private transferred: Counter<string>;

  constructor(logger: Logger) {
    super(logger);

    const labelNames = ["home", "replica", "network", "role"];

    this.balance = new Gauge({
      name: prefix + "_balance",
      help: "Count that indicates how many PRC requests are made",
      labelNames: [...labelNames],
    });

    this.transfers = new Counter({
      name: prefix + "_transfers",
      help: "Histogram that tracks latency of how long does it take to make request in ms",
      labelNames: [...labelNames],
    });

    this.transferred = new Counter({
      name: prefix + "_transferred",
      help: "Counter that tracks error codes from RPC endpoint",
      labelNames: [...labelNames],
    });
  }

  setBalance(
    home: string,
    replica: string,
    network: string,
    role: string,
    balance: number
  ) {
    this.balance.labels(home, replica, network, role).set(balance);
  }

  incTransfers(home: string, replica: string, network: string, role: string) {
    this.transfers.labels(home, replica, network, role).inc();
  }

  incTransferred(
    home: string,
    replica: string,
    network: string,
    role: string,
    amount: number
  ) {
    this.transferred.labels(home, replica, network, role).inc(amount);
  }

  incTransfer(
    home: string,
    replica: string,
    network: string,
    role: string,
    amount: number
  ) {
    this.transfers.labels(home, replica, network, role).inc();
    this.transferred.labels(home, replica, network, role).inc(amount);
  }
}

export class KeyMasterMetricsCollector extends AccountMetricsCollector {
  constructor(logger: Logger) {
    super(logger);
  }
}
