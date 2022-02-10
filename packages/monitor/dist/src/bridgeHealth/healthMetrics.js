"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMetricsCollector = void 0;
const metrics_1 = require("../metrics");
const prom_client_1 = require("prom-client");
class HealthMetricsCollector extends metrics_1.MetricsCollector {
    constructor(environment, logger) {
        super(environment, logger);
        this.numDispatchedGauge = new prom_client_1.Gauge({
            name: 'nomad_monitor_number_messages_dispatched',
            help: 'Gauge that indicates how many messages have been dispatched for a network.',
            labelNames: ['network', 'environment'],
        });
        this.numProcessedGauge = new prom_client_1.Gauge({
            name: 'nomad_monitor_number_messages_processed',
            help: 'Gauge that indicates how many messages have been processed for a network.',
            labelNames: ['network', 'environment'],
        });
        this.numUnprocessedGauge = new prom_client_1.Gauge({
            name: 'nomad_monitor_number_messages_unprocessed',
            help: 'Gauge that indicates how many messages are unprocessed for a network.',
            labelNames: ['network', 'environment'],
        });
    }
    /**
     * Sets the state for a bridge.
     */
    setBridgeState(network, dispatched, processed, unprocessed) {
        this.numDispatchedGauge.set({ network, environment: this.environment }, dispatched);
        this.numProcessedGauge.set({ network, environment: this.environment }, processed);
        this.numUnprocessedGauge.set({ network, environment: this.environment }, unprocessed);
    }
}
exports.HealthMetricsCollector = HealthMetricsCollector;
//# sourceMappingURL=healthMetrics.js.map