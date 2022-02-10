import { MonitorSingle } from '../../monitorSingle';
import { MonitorConfig } from '../../config';
export declare class RelayLatencyMonitor extends MonitorSingle {
    private readonly agent;
    private homeUpdates;
    private replicaUpdates;
    private lastRelayedHomeUpdateIndexes;
    constructor(config: MonitorConfig);
    start(): Promise<void>;
    fetchUpdates(): Promise<void>;
    reportRelayLatencies(): Promise<void>;
    private findMatchingReplicaUpdate;
}
//# sourceMappingURL=relayerMonitor.d.ts.map