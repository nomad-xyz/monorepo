import { MetricsCollector } from '../metrics';
import Logger from 'bunyan';
export declare class LatencyMetricsCollector extends MetricsCollector {
    private averageLatency;
    constructor(environment: string, logger: Logger, gauge_name: string, gauge_help: string);
    setAverageLatency(agent: string, homeNetwork: string, replicaNetwork: string, averageLatency: number): void;
}
//# sourceMappingURL=metrics.d.ts.map