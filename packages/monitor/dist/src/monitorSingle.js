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
exports.MonitorSingle = exports.IndexType = exports.EventType = void 0;
const fetch_1 = require("@nomad-xyz/sdk/nomad/events/fetch");
const NomadMessage_1 = require("@nomad-xyz/sdk/nomad/messages/NomadMessage");
var EventType;
(function (EventType) {
    EventType["Dispatch"] = "dispatch";
    EventType["Update"] = "update";
    EventType["Process"] = "process";
})(EventType = exports.EventType || (exports.EventType = {}));
var IndexType;
(function (IndexType) {
    IndexType[IndexType["Incremental"] = 0] = "Incremental";
    IndexType[IndexType["FromZero"] = 1] = "FromZero";
})(IndexType = exports.IndexType || (exports.IndexType = {}));
class MonitorSingle {
    constructor(config) {
        this.origin = config.origin;
        this.remotes = config.remotes;
        this.context = config.context;
        this.home = config.context.mustGetCore(config.origin).home;
        this.replicas = new Map();
        config.remotes.forEach((remote) => {
            const replica = config.context.mustGetReplicaFor(config.origin, remote);
            this.replicas.set(remote, replica);
        });
        this.lastSeenBlocks = new Map();
        this.logger = config.logger;
        this.metrics = config.metrics;
    }
    main() {
        return __awaiter(this, void 0, void 0, function* () {
            this.metrics.startServer(9090);
            yield this.initializeStartBlocks();
            yield this.start();
        });
    }
    initializeStartBlocks() {
        return __awaiter(this, void 0, void 0, function* () {
            const originProvider = this.networkToProvider(this.origin);
            const latestOriginBlock = yield originProvider.getBlockNumber();
            Object.values(EventType).forEach((eventType) => {
                this.lastSeenBlocks.set(this.origin + eventType, latestOriginBlock - 1000);
            });
            this.remotes.forEach((remote) => __awaiter(this, void 0, void 0, function* () {
                const remoteProvider = this.networkToProvider(remote);
                const latestRemoteBlock = yield remoteProvider.getBlockNumber();
                Object.values(EventType).forEach((eventType) => {
                    this.lastSeenBlocks.set(remote + eventType, latestRemoteBlock - 1000);
                });
            }));
        });
    }
    networkToDomain(network) {
        return this.context.mustGetDomain(network).id;
    }
    networkToProvider(network) {
        const domain = this.networkToDomain(network);
        return this.context.mustGetProvider(domain);
    }
    logInfo(message) {
        this.logger.info(message);
    }
    logDebug(message) {
        this.logger.debug(message);
    }
    logError(message) {
        this.logger.error(message);
    }
    getFilter(network, eventType) {
        if (network == this.origin) {
            switch (eventType) {
                case EventType.Dispatch:
                    return this.home.filters.Dispatch();
                case EventType.Update:
                    return this.home.filters.Update();
                case EventType.Process:
                    throw new Error('No Process events on home!');
            }
        }
        else {
            const replica = this.replicas.get(network);
            switch (eventType) {
                case EventType.Dispatch:
                    throw new Error('No Dispatch events on replica!');
                case EventType.Update:
                    return replica.filters.Update();
                case EventType.Process:
                    return replica.filters.Process();
            }
        }
    }
    query(network, eventType, indexType = IndexType.FromZero) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.networkToProvider(network);
            const latestBlock = yield provider.getBlockNumber();
            let lastSeenBlock, from;
            if (indexType == IndexType.Incremental) {
                lastSeenBlock = this.lastSeenBlocks.get(network + eventType);
                from = lastSeenBlock == undefined ? undefined : lastSeenBlock + 1;
            }
            else {
                lastSeenBlock = undefined;
                from = undefined;
            }
            if (from != undefined && from >= latestBlock) {
                // Return empty array of events if caught up to tip
                this.logInfo(`Caught up to tip on ${network}, returning empty array of events.`);
                return new Promise((resolve) => resolve([]));
            }
            else {
                const contract = network == this.origin ? this.home : this.replicas.get(network);
                const filter = this.getFilter(network, eventType);
                try {
                    this.logInfo(`[Fetch] Fetching ${eventType} for ${network} at blocks ${from !== null && from !== void 0 ? from : 0}..${latestBlock}`);
                    const events = yield (0, fetch_1.getEvents)(this.context, network, contract, filter, from, latestBlock);
                    this.lastSeenBlocks.set(network + eventType, latestBlock);
                    return events;
                }
                catch (e) {
                    this.logger.error(`Error querying data: ${e}`);
                    // bubble this up for next layer to deal with
                    throw e;
                }
            }
        });
    }
    filterDispatchesForReplica(remote, dispatches) {
        const domain = this.networkToDomain(remote);
        return dispatches.filter((dispatch) => {
            const encodedMessage = (0, NomadMessage_1.parseMessage)(dispatch.args.message);
            return encodedMessage.destination == domain;
        });
    }
    fetchInLoop(object, fetch, pauseSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const pause = pauseSeconds * 1000;
            while (true) {
                this.logger.debug(`[Fetch] Sleeping for ${pauseSeconds} seconds.`);
                yield new Promise((resolve) => setTimeout(resolve, pause));
                try {
                    yield fetch.call(object);
                }
                catch (e) {
                    this.logError(`Failed to fetch data: ${e}`);
                }
            }
        });
    }
    reportInLoop(object, report, pauseSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const pause = pauseSeconds * 1000;
            while (true) {
                this.logger.debug(`[Report] Sleeping for ${pauseSeconds} seconds.`);
                yield new Promise((resolve) => setTimeout(resolve, pause));
                yield report.call(object);
            }
        });
    }
}
exports.MonitorSingle = MonitorSingle;
//# sourceMappingURL=monitorSingle.js.map