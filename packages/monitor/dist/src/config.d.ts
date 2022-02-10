import Logger from 'bunyan';
import { NomadContext } from '@nomad-xyz/sdk';
import { MetricsCollector } from './metrics';
export declare class MonitorConfig {
    origin: string;
    remotes: string[];
    context: NomadContext;
    metrics: MetricsCollector;
    logger: Logger;
    googleCredentialsFile: string;
    constructor(script: string, origin: string);
}
export declare function getRpcsFromEnv(): {
    celoRpc: string;
    ethereumRpc: string;
    polygonRpc: string;
    alfajoresRpc: string;
    kovanRpc: string;
    rinkebyRpc: string;
    moonbasealphaRpc: string;
    moonbeamRpc: string;
};
export declare function prepareContext(): void;
export declare function buildConfig(script: string): {
    baseLogger: Logger;
    metrics: MetricsCollector;
    networks: string[];
    environment: string;
    googleCredentialsFile: string;
};
//# sourceMappingURL=config.d.ts.map