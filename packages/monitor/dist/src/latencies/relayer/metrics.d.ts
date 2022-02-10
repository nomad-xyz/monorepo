import Logger from 'bunyan';
import { MetricsCollector } from '../../metrics';
export declare class RelayLatencyMetrics extends MetricsCollector {
    private relayedUpdateLatency;
    constructor(environment: string, logger: Logger);
    reportRelayedUpdateLatency(agent: string, homeNetwork: string, replicaNetwork: string, relayedUpdateLatency: number): void;
}
//# sourceMappingURL=metrics.d.ts.map