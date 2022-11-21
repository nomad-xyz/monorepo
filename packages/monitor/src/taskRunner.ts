export abstract class TaskRunner {
    abstract runTasks(): Promise<void>;
}