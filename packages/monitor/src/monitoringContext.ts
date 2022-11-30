import Logger from "bunyan";
import { MonitoringCollector } from "./metrics";

export class MonitoringContext {
    environment: string;
    logger: Logger;
    metrics: MonitoringCollector;

    constructor(environment: string, logger: Logger, metrics: MonitoringCollector) {
        this.environment = environment;
        this.logger = logger;
        this.metrics = metrics;
    }
}