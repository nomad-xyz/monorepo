import { ethers } from 'ethers';
import { NomadContext } from '@nomad-xyz/sdk';
import { Home, Replica } from '@nomad-xyz/contract-interfaces/core';
import Logger from 'bunyan';
import { RelayLatencyMonitor } from './latencies/relayer/relayerMonitor';
import { ProcessorLatencyMonitor } from './latencies/processor/processorMonitor';
import { BridgeHealthMonitor } from './bridgeHealth/healthMonitor';
import { MetricsCollector } from './metrics';
import { TypedEvent } from '@nomad-xyz/contract-interfaces/core/commons';
import { E2ELatencyMonitor } from './latencies/e2e/e2eMonitor';
import { MonitorConfig } from './config';
declare type Result = ethers.utils.Result;
declare type Provider = ethers.providers.Provider;
export declare enum EventType {
    Dispatch = "dispatch",
    Update = "update",
    Process = "process"
}
export declare enum IndexType {
    Incremental = 0,
    FromZero = 1
}
export declare abstract class MonitorSingle {
    origin: string;
    remotes: string[];
    home: Home;
    replicas: Map<string, Replica>;
    lastSeenBlocks: Map<string, number>;
    context: NomadContext;
    logger: Logger;
    metrics: MetricsCollector;
    constructor(config: MonitorConfig);
    abstract start(): Promise<void>;
    main(): Promise<void>;
    private initializeStartBlocks;
    networkToDomain(network: string): number;
    networkToProvider(network: string): Provider;
    logInfo(message: string): void;
    logDebug(message: string): void;
    logError(message: string): void;
    private getFilter;
    query(network: string, eventType: EventType, indexType?: IndexType): Promise<TypedEvent<Result>[]>;
    filterDispatchesForReplica(remote: string, dispatches: TypedEvent<Result>[]): TypedEvent<ethers.utils.Result>[];
    fetchInLoop(object: E2ELatencyMonitor | RelayLatencyMonitor | ProcessorLatencyMonitor | BridgeHealthMonitor, fetch: () => Promise<void>, pauseSeconds: number): Promise<void>;
    reportInLoop(object: E2ELatencyMonitor | RelayLatencyMonitor | ProcessorLatencyMonitor | BridgeHealthMonitor, report: () => Promise<void>, pauseSeconds: number): Promise<void>;
}
export {};
//# sourceMappingURL=monitorSingle.d.ts.map