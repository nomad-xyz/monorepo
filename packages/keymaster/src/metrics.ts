import { Gauge, Histogram, Counter } from "prom-client";
import Logger from "bunyan";

import { register } from "prom-client";
import express, { Response } from "express";
import { ethers } from "ethers";
import { toEth } from "./utils";
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
  gasUsed: Histogram<string>;
  rpcRequests: Counter<string>;
  rpcErrors: Counter<string>;
  rpcLatency: Histogram<string>;
  malfunctions: Counter<string>;

  constructor(logger: Logger) {
    super(logger);

    const labelNames = ["network"];

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

    this.gasUsed = new Histogram({
      name: prefix + "_gas_used",
      help: "Histogram that tracks gas usage in wei of a transaction that initiated at dispatch, update, relay, receive or process stages.",
      labelNames: [...labelNames, "method"],
      buckets,
    });

    this.malfunctions = new Counter({
      name: prefix + "_malfunctions",
      help: "Counter that tracks unrecoverable malfunctions in a network.",
      labelNames: [...labelNames, "scope"],
    });
  }

  observeLatency(network: string, method: string, ms: number) {
    this.rpcLatency.labels(network, method).observe(ms);
  }

  incRpcRequests(network: string, method: string) {
    this.rpcRequests.labels(network, method).inc();
  }

  incRpcErrors(network: string, method: string, code: string) {
    this.rpcErrors.labels(network, method, code).inc();
  }

  observeGasUsed(network: string, method: string, amount: ethers.BigNumber) {
    this.gasUsed.labels(network, method).observe(toEth(amount));
  }

  incMalfunctions(network: string, scope: string) {
    this.malfunctions.labels(network, scope).inc();
  }
}

export class AccountMetricsCollector extends BaseMetricsCollector {
  // balance
  private balance: Gauge<string>;
  // transfers
  private transfers: Histogram<string>;

  constructor(logger: Logger) {
    super(logger);

    const labelNames = ["home", "replica", "network", "role", "address"];

    this.balance = new Gauge({
      name: prefix + "_balance",
      help: "Gauge that indicates current balance of a wallet",
      labelNames: [...labelNames],
    });

    this.transfers = new Histogram({
      name: prefix + "_transfers",
      help: "Histogram that tracks transfers from bank to agents",
      labelNames: [...labelNames],
      buckets,
    });
  }

  setBalance(
    home: string,
    replica: string,
    network: string,
    role: string,
    balance: ethers.BigNumber,
    address: string
  ) {
    this.balance
      .labels(home, replica, network, role, address)
      .set(toEth(balance));
  }

  observeTransfer(
    home: string,
    replica: string,
    network: string,
    role: string,
    amount: ethers.BigNumber,
    address: string
  ) {
    this.transfers
      .labels(home, replica, network, role, address)
      .observe(toEth(amount));
  }
}

export class KeyMasterMetricsCollector extends AccountMetricsCollector {
  constructor(logger: Logger) {
    super(logger);
  }
}
