import { MonitorSingle } from '../monitorSingle';
import { MonitorConfig } from '../config';
export declare class BridgeHealthMonitor extends MonitorSingle {
    constructor(config: MonitorConfig);
    start(): Promise<void>;
    reportHealth(): Promise<void>;
    getUnprocessedDetails(origin: string, dispatchLogs: any[], processedLogs: any[]): Promise<{
        chain: string;
        transactionHash: any;
        messageHash: any;
        leafIndex: any;
    }[]>;
}
//# sourceMappingURL=healthMonitor.d.ts.map