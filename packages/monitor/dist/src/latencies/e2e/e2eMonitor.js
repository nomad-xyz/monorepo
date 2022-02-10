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
exports.E2ELatencyMonitor = void 0;
const utils_1 = require("../../utils");
const monitorSingle_1 = require("../../monitorSingle");
// Monitor for relayer from 1 home to n replicas
class E2ELatencyMonitor extends monitorSingle_1.MonitorSingle {
    constructor(config) {
        super(config);
        this.dispatchesForReplica = new Map();
        this.replicaProcesses = new Map();
        this.remotes.forEach((remote) => {
            this.dispatchesForReplica.set(remote, []);
            this.replicaProcesses.set(remote, []);
        });
    }
    start() {
        const _super = Object.create(null, {
            fetchInLoop: { get: () => super.fetchInLoop },
            reportInLoop: { get: () => super.reportInLoop }
        });
        return __awaiter(this, void 0, void 0, function* () {
            while (true) {
                try {
                    yield this.fetchDispatches();
                    break;
                }
                catch (e) {
                    this.logError(`Failed to retrieve dispatch events: ${e}. Trying again...`);
                    this.remotes.forEach((remote) => {
                        this.dispatchesForReplica.set(remote, []);
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
                    this.logError(`Failed to retrieve replica process events: ${e}. Trying again...`);
                    this.remotes.forEach((remote) => {
                        this.replicaProcesses.set(remote, []);
                    });
                    continue;
                }
            }
            // Start at last 2 messages for each replica
            this.remotes.forEach((remote) => {
                const existingDispatchesForReplica = this.dispatchesForReplica.get(remote);
                this.dispatchesForReplica.set(remote, existingDispatchesForReplica.slice(existingDispatchesForReplica.length - 2));
                const existingProcessesForReplica = this.replicaProcesses.get(remote);
                this.replicaProcesses.set(remote, existingProcessesForReplica.slice(existingDispatchesForReplica.length - 20));
            });
            const fetchDispatchesTask = _super.fetchInLoop.call(this, this, this.fetchDispatches, 30);
            const fetchProcessesTask = _super.fetchInLoop.call(this, this, this.fetchReplicaProcesses, 30);
            const reportTask = _super.reportInLoop.call(this, this, this.reportLatencies, 15);
            yield Promise.all([fetchDispatchesTask, fetchProcessesTask, reportTask]);
        });
    }
    fetchDispatches() {
        const _super = Object.create(null, {
            query: { get: () => super.query },
            filterDispatchesForReplica: { get: () => super.filterDispatchesForReplica }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const newHomeDispatches = yield _super.query.call(this, this.origin, monitorSingle_1.EventType.Dispatch, monitorSingle_1.IndexType.Incremental);
            for (const remote of this.remotes) {
                const newDispatchesForReplica = _super.filterDispatchesForReplica.call(this, remote, newHomeDispatches);
                const existingDispatchesForReplica = this.dispatchesForReplica.get(remote);
                this.dispatchesForReplica.set(remote, existingDispatchesForReplica
                    .concat(newDispatchesForReplica)
                    .sort(utils_1.compareEvents));
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
                let updatedProcesses = existingProcesses
                    .concat(newReplicaProcesses)
                    .sort(utils_1.compareEvents);
                this.replicaProcesses.set(remote, updatedProcesses);
            }
        });
    }
    reportLatencies() {
        const _super = Object.create(null, {
            networkToProvider: { get: () => super.networkToProvider },
            logInfo: { get: () => super.logInfo }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const originProvider = _super.networkToProvider.call(this, this.origin);
            for (const remote of this.remotes) {
                const dispatchesForReplica = this.dispatchesForReplica.get(remote);
                const replicaProcesses = this.replicaProcesses.get(remote);
                for (const dispatch of dispatchesForReplica) {
                    const matchingProcessIndex = replicaProcesses.findIndex((process) => process.args.messageHash == dispatch.args.messageHash);
                    const matchingProcess = replicaProcesses[matchingProcessIndex];
                    if (matchingProcess == undefined) {
                        this.logInfo(`No matching processes found for ${this.origin}-->${remote} with message hash: ${dispatch.args.messageHash}.`);
                        break;
                    }
                    else {
                        try {
                            const dispatchBlock = dispatch.blockNumber;
                            const currentRemoteBlock = yield originProvider.getBlockNumber();
                            // Time difference is calculated by difference in time between
                            // dispatch block number and current block number on the origin
                            // network. Assumption is that we pick up the process event approx.
                            // the same time it happened.
                            const blockDiff = currentRemoteBlock - dispatchBlock;
                            const secondsDiff = (0, utils_1.blocksToSeconds)(this.origin, blockDiff);
                            _super.logInfo.call(this, `[Report ${this.origin} --> ${remote}] E2E latency for message with hash ${matchingProcess.args.messageHash}: ${secondsDiff} seconds.`);
                            this.metrics.reportTotalMessageLatency(this.origin, remote, secondsDiff);
                            // Now that we've seen processed message, delete data from memory
                            this.dispatchesForReplica.set(remote, this.dispatchesForReplica.get(remote).slice(1));
                            const cleanedReplicaProcesses = this.replicaProcesses
                                .get(remote)
                                .splice(matchingProcessIndex, 1);
                            this.replicaProcesses.set(remote, cleanedReplicaProcesses);
                        }
                        catch (e) {
                            this.logError(`Failed to calculate/report process latency: ${e}`);
                        }
                    }
                }
            }
        });
    }
}
exports.E2ELatencyMonitor = E2ELatencyMonitor;
//# sourceMappingURL=e2eMonitor.js.map