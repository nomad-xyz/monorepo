import Logger, {  } from "bunyan";
import { KeyMasterMetricsCollector } from "./metrics";
import { BunyanLevel, createLogger, getEnvironment } from "./utils";

export class Context {
    logger: Logger;
    metrics: KeyMasterMetricsCollector;

    constructor(_logger?: Logger, _metrics?: KeyMasterMetricsCollector) {
        const environment = getEnvironment();
        console.log(environment);
        const logLevel = (process.env.LOG_LEVEL || 'debug') as BunyanLevel;
        this.logger = _logger || createLogger('keymaster', {environment, logLevel});
        console.log(!!_metrics)
        this.metrics = _metrics || new KeyMasterMetricsCollector(environment, this.logger);
    }

    with(r: Record<string, string>){
        const logger = this.logger.child(r);
        return new Context(logger, this.metrics);
    }
}