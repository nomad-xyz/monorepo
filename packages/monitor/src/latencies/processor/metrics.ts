import { Histogram } from 'prom-client';
import Logger from 'bunyan';
import { MetricsCollector } from '../../metrics';

export class ProcessLatencyMetrics extends MetricsCollector {
  private processedMessageLatency: Histogram<string>;

  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    this.processedMessageLatency = new Histogram({
      name: 'nomad_monitor_processor_processed_message_latency',
      help: 'Histogram that tracks latency of last processed messages since its corresponding update was relayed.',
      labelNames: ['agent', 'home', 'replica'],
      buckets: [0, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
    });
  }

  reportProcessedMessageLatency(
    agent: string,
    homeNetwork: string,
    replicaNetwork: string,
    processedMessageLatency: number,
  ) {
    this.processedMessageLatency
      .labels(agent, homeNetwork, replicaNetwork)
      .observe(processedMessageLatency);
  }
}
