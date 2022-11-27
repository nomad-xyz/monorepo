import { MonitoringCollector } from "./metrics";
import Logger from "bunyan";
import { sleep } from ".";

export abstract class TaskRunner {
    logger: Logger;
    metrics: MonitoringCollector;

    constructor(logger: Logger, metrics: MonitoringCollector) {
        this.logger = logger;
        this.metrics = metrics;
    }

    abstract tasks(): Promise<void>[];
    async runTasks(): Promise<void> {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            this.logger.info(`Started tasks`);
            const start = Date.now();
    
            await Promise.all(this.tasks());
    
            const time = (Date.now() - start)/1000;
            const cooldown = this.cooldown();
            this.logger.info(`Finished tasks in ${time.toFixed()} seconds, sleeping ${cooldown} seconds`);
            await sleep(cooldown * 1000);
        }
    }

    abstract cooldown(): number;
    async record<T>(request: Promise<T>, domain: string, requestName: string, ...labels: string[]): Promise<T> {
        return await this.metrics.recordRequest(request, domain, requestName, ...labels);
    }
}