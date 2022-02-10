import Logger from 'bunyan';
export declare class MetricsCollector {
    readonly environment: string;
    private readonly logger;
    constructor(environment: string, logger: Logger);
    /**
     * Starts a server that exposes metrics in the prometheus format
     */
    startServer(port: number): void;
}
//# sourceMappingURL=metrics.d.ts.map