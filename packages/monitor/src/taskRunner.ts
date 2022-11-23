import { MonitoringCollector } from "./metrics";

export abstract class TaskRunner {
    abstract runTasks(): Promise<void>;
    abstract get metrics(): MonitoringCollector;
    async record<T>(request: Promise<T>, domain: string, requestName: string, ...labels: string[]): Promise<T> {
        return await this.metrics.recordRequest(request, domain, requestName, ...labels);
    }
}