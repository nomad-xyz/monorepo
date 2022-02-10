import { NomadContext, NomadStatus } from '@nomad-xyz/sdk';
export declare function blockExplorerURL(domainName: string, transactionHash: string): string | undefined;
export declare const STATUS_TO_STRING: {
    0: string;
    1: string;
    2: string;
    3: string;
};
export declare function printStatus(context: NomadContext, nomadStatus: NomadStatus): void;
export declare function writeUnprocessedMessages(unprocessedDetails: any[], origin: string): void;
export declare function getMonitorMetrics(origin: string, dispatchLogs: any[], processedLogs: any[], unprocessedDetails: any[]): {
    summary: {
        network: string;
        dispatched: number;
        processed: number;
        unprocessed: number;
        oldest: string | undefined;
    };
};
//# sourceMappingURL=print.d.ts.map