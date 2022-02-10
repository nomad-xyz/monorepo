"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessLatencyMetrics = void 0;
const prom_client_1 = require("prom-client");
const metrics_1 = require("../../metrics");
class ProcessLatencyMetrics extends metrics_1.MetricsCollector {
    constructor(environment, logger) {
        super(environment, logger);
        this.processedMessageLatency = new prom_client_1.Histogram({
            name: 'nomad_monitor_processor_processed_message_latency',
            help: 'Histogram that tracks latency of last processed messages since its corresponding update was relayed.',
            labelNames: ['agent', 'home', 'replica'],
            buckets: [0, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
        });
    }
    reportProcessedMessageLatency(agent, homeNetwork, replicaNetwork, processedMessageLatency) {
        this.processedMessageLatency
            .labels(agent, homeNetwork, replicaNetwork)
            .observe(processedMessageLatency);
    }
}
exports.ProcessLatencyMetrics = ProcessLatencyMetrics;
//# sourceMappingURL=metrics.js.map