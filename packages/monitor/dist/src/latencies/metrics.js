"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LatencyMetricsCollector = void 0;
const metrics_1 = require("../metrics");
const prom_client_1 = require("prom-client");
class LatencyMetricsCollector extends metrics_1.MetricsCollector {
    constructor(environment, logger, gauge_name, gauge_help) {
        super(environment, logger);
        this.averageLatency = new prom_client_1.Gauge({
            name: gauge_name,
            help: gauge_help,
            labelNames: ['agent', 'environment', 'homeNetwork', 'replicaNetwork'],
        });
    }
    setAverageLatency(agent, homeNetwork, replicaNetwork, averageLatency) {
        this.averageLatency.set({ agent, environment: this.environment, homeNetwork, replicaNetwork }, averageLatency);
    }
}
exports.LatencyMetricsCollector = LatencyMetricsCollector;
//# sourceMappingURL=metrics.js.map