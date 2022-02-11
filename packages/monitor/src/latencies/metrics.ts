import { MetricsCollector } from '../metrics';
import { Gauge } from 'prom-client';
import Logger from 'bunyan';

export class LatencyMetricsCollector extends MetricsCollector {
  private averageLatency: Gauge<string>;

  constructor(
    environment: string,
    logger: Logger,
    gauge_name: string,
    gauge_help: string,
  ) {
    super(environment, logger);

    this.averageLatency = new Gauge({
      name: gauge_name,
      help: gauge_help,
      labelNames: ['agent', 'environment', 'homeNetwork', 'replicaNetwork'],
    });
  }

  setAverageLatency(
    agent: string,
    homeNetwork: string,
    replicaNetwork: string,
    averageLatency: number,
  ) {
    this.averageLatency.set(
      { agent, environment: this.environment, homeNetwork, replicaNetwork },
      averageLatency,
    );
  }
}
