"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessorLatencyMonitor = void 0;
const monitorSingle_1 = require("../../monitorSingle");
const utils_1 = require("../../utils");
// Monitor for processor from 1 home to n replicas
class ProcessorLatencyMonitor extends monitorSingle_1.MonitorSingle {
    constructor(config) {
        super(config);
        this.agent = 'processor';
        this.homeCommittedRootToDispatches = new Map();
        this.replicaUpdates = new Map();
        config.remotes.forEach((remote) => {
            this.replicaUpdates.set(remote, []);
        });
        this.replicaProcesses = new Map();
        config.remotes.forEach((remote) => {
            this.replicaProcesses.set(remote, []);
        });
        this.lastSeenReplicaUpdateIndexes = new Map();
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            while (true) {
                try {
                    yield this.fetchDispatches();
                    break;
                }
                catch (e) {
                    this.logError(`Failed to retrieve dispatch events: ${e}. Trying again...`);
                    this.remotes.forEach((remote) => {
                        this.homeCommittedRootToDispatches.set(remote, []);
                    });
                    continue;
                }
            }
            while (true) {
                try {
                    yield this.fetchReplicaProcesses();
                    break;
                }
                catch (e) {
                    this.logError(`Failed to retrieve dispatch events: ${e}. Trying again...`);
                    this.remotes.forEach((remote) => {
                        this.replicaProcesses.set(remote, []);
                    });
                    continue;
                }
            }
            while (true) {
                try {
                    yield this.fetchReplicaUpdates();
                    break;
                }
                catch (e) {
                    this.logError(`Failed to retrieve update events: ${e}. Trying again...`);
                    this.remotes.forEach((remote) => {
                        this.replicaUpdates.set(remote, []);
                    });
                    continue;
                }
            }
            // Start at 2 latest replica updates
            this.remotes.forEach((remote) => {
                this.replicaUpdates.set(remote, this.replicaUpdates
                    .get(remote)
                    .slice(this.replicaUpdates.get(remote).length - 2));
                this.lastSeenReplicaUpdateIndexes.set(remote, 0);
            });
            const fetchDispatchesTask = this.fetchInLoop(this, this.fetchDispatches, 30);
            const fetchReplicaUpdatesTask = this.fetchInLoop(this, this.fetchReplicaUpdates, 30);
            const fetchReplicaProcessesTask = this.fetchInLoop(this, this.fetchReplicaProcesses, 30);
            const reportProcessLatenciesTask = this.reportInLoop(this, this.reportProcessLatencies, 15);
            yield Promise.all([
                fetchDispatchesTask,
                fetchReplicaUpdatesTask,
                fetchReplicaProcessesTask,
                reportProcessLatenciesTask,
            ]);
        });
    }
    fetchDispatches() {
        const _super = Object.create(null, {
            query: { get: () => super.query }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const homeDispatches = yield _super.query.call(this, this.origin, monitorSingle_1.EventType.Dispatch, monitorSingle_1.IndexType.Incremental);
            homeDispatches.forEach((dispatch) => {
                var _a;
                const committedRoot = dispatch.args.committedRoot;
                const existingDispatches = (_a = this.homeCommittedRootToDispatches.get(committedRoot)) !== null && _a !== void 0 ? _a : [];
                this.homeCommittedRootToDispatches.set(committedRoot, existingDispatches.concat([dispatch]));
            });
        });
    }
    fetchReplicaUpdates() {
        const _super = Object.create(null, {
            query: { get: () => super.query }
        });
        return __awaiter(this, void 0, void 0, function* () {
            for (const remote of this.remotes) {
                const newReplicaUpdates = yield _super.query.call(this, remote, monitorSingle_1.EventType.Update, monitorSingle_1.IndexType.Incremental);
                const existingUpdates = this.replicaUpdates.get(remote);
                let updatedUpdates = existingUpdates
                    .concat(newReplicaUpdates)
                    .sort(utils_1.compareEvents);
                this.replicaUpdates.set(remote, updatedUpdates);
            }
        });
    }
    fetchReplicaProcesses() {
        const _super = Object.create(null, {
            query: { get: () => super.query }
        });
        return __awaiter(this, void 0, void 0, function* () {
            for (const remote of this.remotes) {
                const newReplicaProcesses = yield _super.query.call(this, remote, monitorSingle_1.EventType.Process, monitorSingle_1.IndexType.Incremental);
                const existingProcesses = this.replicaProcesses.get(remote);
                let updatedProcesses = existingProcesses.concat(newReplicaProcesses);
                updatedProcesses.sort(utils_1.compareEvents);
                this.replicaProcesses.set(remote, updatedProcesses);
            }
        });
    }
    reportProcessLatencies() {
        const _super = Object.create(null, {
            filterDispatchesForReplica: { get: () => super.filterDispatchesForReplica },
            logInfo: { get: () => super.logInfo }
        });
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            for (const remote of this.remotes) {
                const lastSeenReplicaUpdateIndex = this.lastSeenReplicaUpdateIndexes.get(remote);
                const newReplicaUpdates = this.replicaUpdates
                    .get(remote)
                    .slice(lastSeenReplicaUpdateIndex);
                for (const replicaUpdate of newReplicaUpdates) {
                    const dispatchesUnderUpdate = (_a = this.homeCommittedRootToDispatches.get(replicaUpdate.args.oldRoot)) !== null && _a !== void 0 ? _a : [];
                    const dispatchesForReplica = _super.filterDispatchesForReplica.call(this, remote, dispatchesUnderUpdate);
                    const matchingProcesses = this.getMatchingProcesses(remote, dispatchesForReplica);
                    if (matchingProcesses.length == 0) {
                        this.logInfo(`No matching processes found for ${this.origin}-->${remote} under update ${replicaUpdate.args.newRoot}.`);
                        break;
                    }
                    matchingProcesses.forEach((process) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const latencySeconds = yield this.calculateLatencyForProcess(remote, replicaUpdate, process);
                            _super.logInfo.call(this, `[Report ${this.origin} --> ${remote}] Process latency for message with hash ${process.args.messageHash} on replica ${remote}: ${latencySeconds} seconds.`);
                            this.metrics.reportProcessedMessageLatency(this.agent, this.origin, remote, latencySeconds);
                        }
                        catch (e) {
                            this.logError(`Failed to calculate/report Process latency: ${e}`);
                        }
                    }));
                    this.lastSeenReplicaUpdateIndexes.set(remote, this.lastSeenReplicaUpdateIndexes.get(remote) + 1);
                }
            }
        });
    }
    getMatchingProcesses(remote, dispatches) {
        let matchingProcesses = [];
        for (const dispatch of dispatches) {
            const dispatchMessageHash = dispatch.args.messageHash;
            const matchingProcess = this.replicaProcesses
                .get(remote)
                .find((process) => {
                return process.args.messageHash == dispatchMessageHash;
            });
            if (matchingProcess != undefined) {
                matchingProcesses.push(matchingProcess);
            }
        }
        return matchingProcesses;
    }
    calculateLatencyForProcess(remote, update, process) {
        return __awaiter(this, void 0, void 0, function* () {
            const replicaUpdateBlock = update.blockNumber;
            const replicaProcessBlock = process.blockNumber;
            // Use block number and latest block as approximation
            const blockDiff = replicaProcessBlock - replicaUpdateBlock;
            const secondsDiff = (0, utils_1.blocksToSeconds)(remote, blockDiff);
            return (secondsDiff -
                (0, utils_1.getFraudWindowSeconds)(this.origin) -
                (0, utils_1.getTimelagSeconds)(remote));
        });
    }
}
exports.ProcessorLatencyMonitor = ProcessorLatencyMonitor;
//# sourceMappingURL=processorMonitor.js.map