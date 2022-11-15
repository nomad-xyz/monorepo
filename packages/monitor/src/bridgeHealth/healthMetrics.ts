import { MetricsCollector } from '../metrics';
import { Gauge } from 'prom-client';
import Logger from 'bunyan';

export class HealthMetricsCollector extends MetricsCollector {
  private numDispatchedGauge: Gauge<string>;
  private numProcessedGauge: Gauge<string>;
  private numUnprocessedGauge: Gauge<string>;

  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    this.numDispatchedGauge = new Gauge({
      name: 'nomad_monitor_number_messages_dispatched',
      help: 'Gauge that indicates how many messages have been dispatched for a network.',
      labelNames: ['network', 'environment'],
    });

    this.numProcessedGauge = new Gauge({
      name: 'nomad_monitor_number_messages_processed',
      help: 'Gauge that indicates how many messages have been processed for a network.',
      labelNames: ['network', 'environment'],
    });

    this.numUnprocessedGauge = new Gauge({
      name: 'nomad_monitor_number_messages_unprocessed',
      help: 'Gauge that indicates how many messages are unprocessed for a network.',
      labelNames: ['network', 'environment'],
    });
  }

  /**
   * Sets the state for a bridge.
   */
  setBridgeState(
    network: string,
    dispatched: number,
    processed: number,
    unprocessed: number,
  ) {
    this.numDispatchedGauge.set(
      { network, environment: this.environment },
      dispatched,
    );
  
    this.numProcessedGauge.set(
      { network, environment: this.environment },
      processed,
    );
  
    this.numUnprocessedGauge.set(
      { network, environment: this.environment },
      unprocessed,
    );
  }
}
