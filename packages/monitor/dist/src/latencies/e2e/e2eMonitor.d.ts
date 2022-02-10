import { MonitorSingle } from '../../monitorSingle';
import { MonitorConfig } from '../../config';
export declare class E2ELatencyMonitor extends MonitorSingle {
    private dispatchesForReplica;
    private replicaProcesses;
    constructor(config: MonitorConfig);
    start(): Promise<void>;
    fetchDispatches(): Promise<void>;
    fetchReplicaProcesses(): Promise<void>;
    reportLatencies(): Promise<void>;
}
//# sourceMappingURL=e2eMonitor.d.ts.map