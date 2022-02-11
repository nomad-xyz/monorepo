import { Histogram } from 'prom-client';
import Logger from 'bunyan';
import { MetricsCollector } from '../../metrics';

export class RelayLatencyMetrics extends MetricsCollector {
  private relayedUpdateLatency: Histogram<string>;

  constructor(environment: string, logger: Logger) {
    super(environment, logger);

    this.relayedUpdateLatency = new Histogram({
      name: 'nomad_monitor_relayer_last_relayed_update_latency',
      help: 'Histogram that tracks latencies of relayed updates.',
      labelNames: ['agent', 'home', 'replica'],
      buckets: [0, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
    });
  }

  reportRelayedUpdateLatency(
    agent: string,
    homeNetwork: string,
    replicaNetwork: string,
    relayedUpdateLatency: number,
  ) {
    this.relayedUpdateLatency
      .labels(agent, homeNetwork, replicaNetwork)
      .observe(relayedUpdateLatency);
  }
}
