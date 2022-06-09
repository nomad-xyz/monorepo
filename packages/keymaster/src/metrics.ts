import { Gauge, Histogram, Counter } from 'prom-client';
import Logger from 'bunyan';

import { register } from 'prom-client';
import express, { Response } from 'express';
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

export class BaseMetricsCollector extends MetricsCollector {
  gasUsed: Counter<string>;
  rpcRequests: Counter<string>;
  rpcErrors: Counter<string>;
  rpcLatency: Histogram<string>;


  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    const labelNames = ['environment', 'home'];


    this.rpcRequests = new Counter({
      name: prefix + '_rpc_requests',
      help: 'Count that indicates how many PRC requests are made',
      labelNames: [...labelNames, 'method'],
    });

    this.rpcLatency = new Histogram({
      name: prefix + '_rpc_latency',
      help: 'Histogram that tracks latency of how long does it take to make request in ms',
      labelNames: [...labelNames, 'method'],
      buckets,
    });

    this.rpcErrors = new Counter({
      name: prefix + '_rpc_errors',
      help: 'Counter that tracks error codes from RPC endpoint',
      labelNames: [...labelNames, 'method', 'code'],
    });

    this.gasUsed = new Counter({
      name: prefix + '_gas_used',
      help: 'Histogram that tracks gas usage in wei of a transaction that initiated at dispatch, update, relay, receive or process stages.',
      labelNames: [...labelNames, 'method'],
    });
  }

  observeLatency(home: string, method: string, ms: number) {
    this.rpcLatency.labels(this.environment, home, method,).observe(ms);
  }

  incRpcRequests(home: string, method: string) {
    this.rpcRequests.labels(this.environment, home, method,).inc();
  }

  incRpcErrors(home: string, method: string, code: string) {
    this.rpcErrors.labels(this.environment, home, method, code).inc();
  }

  incGasUsed(home: string, method: string, amount: number) {
    this.gasUsed.labels(this.environment, home, method,).inc(amount);
  }
}

export class AccountMetricsCollector extends BaseMetricsCollector {
  // balance
  private balance: Gauge<string>;
  // transfers
  private transfers: Counter<string>;
  // transferred
  private transferred: Counter<string>;

  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    const labelNames = ['environment', 'home', 'replica', 'network', 'type'];

    this.balance = new Gauge({
      name: prefix + '_balance',
      help: 'Count that indicates how many PRC requests are made',
      labelNames: [...labelNames],
    });

    this.transfers = new Counter({
      name: prefix + '_transfers',
      help: 'Histogram that tracks latency of how long does it take to make request in ms',
      labelNames: [...labelNames],
    });

    this.transferred = new Counter({
      name: prefix + '_transferred',
      help: 'Counter that tracks error codes from RPC endpoint',
      labelNames: [...labelNames],
    });
  }

  setBalance(home: string, replica: string, network: string, type: string, balance: number, ) {
    this.balance.labels(this.environment, home, replica, network, type).set(balance);
  }

  incTransfers(home: string, replica: string, network: string, type: string,) {
    this.transfers.labels(this.environment, home, replica, network, type).inc();
  }

  incTransferred(home: string, replica: string, network: string, type: string, amount: number) {
    this.transferred.labels(this.environment, home, replica, network, type).inc(amount);
  }

  incTransfer(home: string, replica: string, network: string, type: string, amount: number) {
    this.transfers.labels(this.environment, home, replica, network, type).inc();
    this.transferred.labels(this.environment, home, replica, network, type).inc(amount);
  }
}

export class KeyMasterMetricsCollector extends AccountMetricsCollector {
  
  constructor(environment: string, logger: Logger) {
    super(environment, logger);
  }
}