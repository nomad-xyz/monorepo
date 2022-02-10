"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayLatencyMetrics = void 0;
const prom_client_1 = require("prom-client");
const metrics_1 = require("../../metrics");
class RelayLatencyMetrics extends metrics_1.MetricsCollector {
    constructor(environment, logger) {
        super(environment, logger);
        this.relayedUpdateLatency = new prom_client_1.Histogram({
            name: 'nomad_monitor_relayer_last_relayed_update_latency',
            help: 'Histogram that tracks latencies of relayed updates.',
            labelNames: ['agent', 'home', 'replica'],
            buckets: [0, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
        });
    }
    reportRelayedUpdateLatency(agent, homeNetwork, replicaNetwork, relayedUpdateLatency) {
        this.relayedUpdateLatency
            .labels(agent, homeNetwork, replicaNetwork)
            .observe(relayedUpdateLatency);
    }
}
exports.RelayLatencyMetrics = RelayLatencyMetrics;
//# sourceMappingURL=metrics.js.map