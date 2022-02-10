import Logger from 'bunyan';
import { MetricsCollector } from '../../metrics';
export declare class ProcessLatencyMetrics extends MetricsCollector {
    private processedMessageLatency;
    constructor(environment: string, logger: Logger);
    reportProcessedMessageLatency(agent: string, homeNetwork: string, replicaNetwork: string, processedMessageLatency: number): void;
}
//# sourceMappingURL=metrics.d.ts.map