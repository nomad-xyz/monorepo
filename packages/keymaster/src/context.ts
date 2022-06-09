import Logger, {  } from "bunyan";
import { KeyMasterMetricsCollector } from "./metrics";
import { BunyanLevel, createLogger, getEnvironment } from "./utils";
import dotenv from 'dotenv';
dotenv.config();

export class Context {
    logger: Logger;
    metrics: KeyMasterMetricsCollector;

    constructor(_logger?: Logger, _metrics?: KeyMasterMetricsCollector) {
        const environment = getEnvironment();
        const level = (process.env.LOG_LEVEL || 'debug') as BunyanLevel;
        this.logger = _logger || createLogger('keymaster', {environment, level});
        this.metrics = _metrics || new KeyMasterMetricsCollector(environment, this.logger);
    }

    with(r: Record<string, string>){
        const logger = this.logger.child(r);
        return new Context(logger, this.metrics);
    }
}