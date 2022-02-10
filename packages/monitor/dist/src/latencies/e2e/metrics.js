"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2ELatencyMetrics = void 0;
const prom_client_1 = require("prom-client");
const metrics_1 = require("../../metrics");
class E2ELatencyMetrics extends metrics_1.MetricsCollector {
    constructor(environment, logger) {
        super(environment, logger);
        this.processedMessageLatency = new prom_client_1.Histogram({
            name: 'nomad_e2e_message_process_latency',
            help: 'Histogram that tracks latency of e2e message latency from dispatch to process.',
            labelNames: ['home', 'replica'],
            buckets: [
                1 * 60,
                5 * 60,
                10 * 60,
                20 * 60,
                30 * 60,
                60 * 60,
                120 * 60,
                240 * 60,
                480 * 60,
                960 * 60,
                1920 * 60, // 32 hrs
            ],
        });
    }
    reportTotalMessageLatency(homeNetwork, replicaNetwork, messageLatency) {
        this.processedMessageLatency
            .labels(homeNetwork, replicaNetwork)
            .observe(messageLatency);
    }
}
exports.E2ELatencyMetrics = E2ELatencyMetrics;
//# sourceMappingURL=metrics.js.map