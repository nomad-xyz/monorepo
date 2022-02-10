import { MetricsCollector } from '../metrics';
import Logger from 'bunyan';
export declare class HealthMetricsCollector extends MetricsCollector {
    private numDispatchedGauge;
    private numProcessedGauge;
    private numUnprocessedGauge;
    constructor(environment: string, logger: Logger);
    /**
     * Sets the state for a bridge.
     */
    setBridgeState(network: string, dispatched: number, processed: number, unprocessed: number): void;
}
//# sourceMappingURL=healthMetrics.d.ts.map