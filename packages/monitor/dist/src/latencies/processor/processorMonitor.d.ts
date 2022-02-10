import { ethers } from 'ethers';
import { TypedEvent } from '@nomad-xyz/contract-interfaces/core/commons';
import { MonitorSingle } from '../../monitorSingle';
import { MonitorConfig } from '../../config';
declare type Result = ethers.utils.Result;
export declare class ProcessorLatencyMonitor extends MonitorSingle {
    private readonly agent;
    private homeCommittedRootToDispatches;
    private replicaUpdates;
    private replicaProcesses;
    private lastSeenReplicaUpdateIndexes;
    constructor(config: MonitorConfig);
    start(): Promise<void>;
    fetchDispatches(): Promise<void>;
    fetchReplicaUpdates(): Promise<void>;
    fetchReplicaProcesses(): Promise<void>;
    reportProcessLatencies(): Promise<void>;
    getMatchingProcesses(remote: string, dispatches: TypedEvent<Result>[]): TypedEvent<ethers.utils.Result>[];
    calculateLatencyForProcess(remote: string, update: TypedEvent<Result>, process: TypedEvent<Result>): Promise<number>;
}
export {};
//# sourceMappingURL=processorMonitor.d.ts.map