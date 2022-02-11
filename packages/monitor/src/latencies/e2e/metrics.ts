import { Histogram } from 'prom-client';
import Logger from 'bunyan';
import { MetricsCollector } from '../../metrics';

export class E2ELatencyMetrics extends MetricsCollector {
  private processedMessageLatency: Histogram<string>;

  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    this.processedMessageLatency = new Histogram({
      name: 'nomad_e2e_message_process_latency',
      help: 'Histogram that tracks latency of e2e message latency from dispatch to process.',
      labelNames: ['home', 'replica'],
      buckets: [
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
      ],
    });
  }

  reportTotalMessageLatency(
    homeNetwork: string,
    replicaNetwork: string,
    messageLatency: number,
  ) {
    this.processedMessageLatency
      .labels(homeNetwork, replicaNetwork)
      .observe(messageLatency);
  }
}
