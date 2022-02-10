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
exports.RelayLatencyMonitor = void 0;
const utils_1 = require("../../utils");
const monitorSingle_1 = require("../../monitorSingle");
// Monitor for relayer from 1 home to n replicas
class RelayLatencyMonitor extends monitorSingle_1.MonitorSingle {
    constructor(config) {
        super(config);
        this.agent = 'relayer';
        this.homeUpdates = [];
        this.replicaUpdates = new Map();
        config.remotes.forEach((remote) => {
            this.replicaUpdates.set(remote, []);
        });
        this.lastRelayedHomeUpdateIndexes = new Map();
    }
    start() {
        const _super = Object.create(null, {
            fetchInLoop: { get: () => super.fetchInLoop },
            reportInLoop: { get: () => super.reportInLoop }
        });
        return __awaiter(this, void 0, void 0, function* () {
            // Fetch updates in loop until we have successfully gotten all of them
            while (true) {
                try {
                    yield this.fetchUpdates();
                    break;
                }
                catch (e) {
                    this.logError(`Failed to retrieve update events: ${e}. Trying again...`);
                    this.homeUpdates = [];
                    this.remotes.forEach((remote) => {
                        this.replicaUpdates.set(remote, []);
                    });
                    continue;
                }
            }
            this.remotes.forEach((remote) => this.lastRelayedHomeUpdateIndexes.set(remote, this.homeUpdates.length - 1));
            const fetchTask = _super.fetchInLoop.call(this, this, this.fetchUpdates, 30);
            const reportTask = _super.reportInLoop.call(this, this, this.reportRelayLatencies, 15);
            yield Promise.all([fetchTask, reportTask]);
        });
    }
    fetchUpdates() {
        const _super = Object.create(null, {
            query: { get: () => super.query }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const newHomeUpdates = yield _super.query.call(this, this.origin, monitorSingle_1.EventType.Update, monitorSingle_1.IndexType.Incremental);
            this.homeUpdates = this.homeUpdates.concat(newHomeUpdates);
            for (const remote of this.remotes) {
                const newReplicaUpdates = yield _super.query.call(this, remote, monitorSingle_1.EventType.Update, monitorSingle_1.IndexType.Incremental);
                const existingUpdates = this.replicaUpdates.get(remote);
                this.replicaUpdates.set(remote, existingUpdates.concat(newReplicaUpdates));
            }
        });
    }
    reportRelayLatencies() {
        const _super = Object.create(null, {
            networkToProvider: { get: () => super.networkToProvider },
            logInfo: { get: () => super.logInfo }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const originProvider = _super.networkToProvider.call(this, this.origin);
            for (const remote of this.remotes) {
                const lastRelayedHomeUpdateIndexes = this.lastRelayedHomeUpdateIndexes.get(remote);
                const newHomeUpdates = this.homeUpdates.slice(lastRelayedHomeUpdateIndexes);
                for (const homeUpdate of newHomeUpdates) {
                    const matchingReplicaUpdate = this.findMatchingReplicaUpdate(remote, homeUpdate);
                    if (matchingReplicaUpdate != undefined) {
                        break;
                    }
                    else {
                        try {
                            const homeUpdateBlock = homeUpdate.blockNumber;
                            const currentBlock = yield originProvider.getBlockNumber();
                            // Use block number and current block as approximation
                            const blockDiff = currentBlock - homeUpdateBlock;
                            const secondsDiff = (0, utils_1.blocksToSeconds)(this.origin, blockDiff);
                            _super.logInfo.call(this, `[Report ${this.origin} --> ${remote}] Relay latency for update with new root ${homeUpdate.args.newRoot} on replica ${remote}: ${secondsDiff} seconds.`);
                            this.metrics.reportRelayedUpdateLatency(this.agent, this.origin, remote, secondsDiff);
                            this.lastRelayedHomeUpdateIndexes.set(remote, this.lastRelayedHomeUpdateIndexes.get(remote) + 1);
                        }
                        catch (e) {
                            this.logError(`Failed to calculate/report relay latency for ${this.origin} --> ${remote}: ${e}`);
                        }
                    }
                }
            }
        });
    }
    findMatchingReplicaUpdate(remote, homeUpdate) {
        const replicaUpdates = this.replicaUpdates.get(remote);
        return replicaUpdates.find((update) => update.args.newRoot == homeUpdate.args.newRoot);
    }
}
exports.RelayLatencyMonitor = RelayLatencyMonitor;
//# sourceMappingURL=relayerMonitor.js.map