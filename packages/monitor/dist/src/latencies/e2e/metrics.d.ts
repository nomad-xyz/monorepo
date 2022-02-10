import Logger from 'bunyan';
import { MetricsCollector } from '../../metrics';
export declare class E2ELatencyMetrics extends MetricsCollector {
    private processedMessageLatency;
    constructor(environment: string, logger: Logger);
    reportTotalMessageLatency(homeNetwork: string, replicaNetwork: string, messageLatency: number): void;
}
//# sourceMappingURL=metrics.d.ts.map