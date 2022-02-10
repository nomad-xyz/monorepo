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
exports.BridgeHealthMonitor = void 0;
const print_1 = require("../print");
const monitorSingle_1 = require("../monitorSingle");
class BridgeHealthMonitor extends monitorSingle_1.MonitorSingle {
    constructor(config) {
        super(config);
    }
    start() {
        const _super = Object.create(null, {
            reportInLoop: { get: () => super.reportInLoop }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.reportInLoop.call(this, this, this.reportHealth, 120);
        });
    }
    reportHealth() {
        const _super = Object.create(null, {
            logInfo: { get: () => super.logInfo },
            query: { get: () => super.query },
            logError: { get: () => super.logError }
        });
        return __awaiter(this, void 0, void 0, function* () {
            _super.logInfo.call(this, `Checking ${this.origin}`);
            _super.logInfo.call(this, `Get Dispatch logs from ${this.origin}`);
            let dispatchLogs, processLogs;
            try {
                dispatchLogs = yield _super.query.call(this, this.origin, monitorSingle_1.EventType.Dispatch, monitorSingle_1.IndexType.FromZero);
            }
            catch (e) {
                _super.logError.call(this, `Encountered error while fetching Dispatch logs for ${this.origin}, bailing: ${e}`);
                return;
            }
            const processedLogs = [];
            for (const remote of this.remotes) {
                _super.logInfo.call(this, `Get Process logs from ${remote} for ${this.origin}`);
                processLogs = yield _super.query.call(this, remote, monitorSingle_1.EventType.Process, monitorSingle_1.IndexType.FromZero);
                try {
                    dispatchLogs = yield _super.query.call(this, this.origin, monitorSingle_1.EventType.Dispatch, monitorSingle_1.IndexType.FromZero);
                }
                catch (e) {
                    _super.logError.call(this, `Encountered error while fetching Process logs from ${remote} for ${this.origin}, bailing: ${e}`);
                    return;
                }
                processedLogs.push(...processLogs);
            }
            const unprocessedDetails = yield this.getUnprocessedDetails(this.origin, dispatchLogs, processedLogs);
            const summary = (0, print_1.getMonitorMetrics)(this.origin, dispatchLogs, processedLogs, unprocessedDetails);
            _super.logInfo.call(this, `${JSON.stringify(summary)}\n ${this.origin} Summary`);
            this.metrics.setBridgeState(this.origin, dispatchLogs.length, processedLogs.length, unprocessedDetails.length);
            // write details to file
            (0, print_1.writeUnprocessedMessages)(unprocessedDetails, this.origin);
        });
    }
    getUnprocessedDetails(origin, dispatchLogs, processedLogs) {
        const processedMessageHashes = processedLogs.map((log) => log.args.messageHash);
        const unprocessedMessages = dispatchLogs.filter((log) => !processedMessageHashes.includes(log.args.messageHash));
        const promises = unprocessedMessages.map((log) => __awaiter(this, void 0, void 0, function* () {
            const transaction = yield log.getTransaction();
            return {
                chain: origin,
                transactionHash: transaction.hash,
                messageHash: log.args[0],
                leafIndex: log.args[1].toNumber(),
            };
        }));
        return Promise.all(promises);
    }
}
exports.BridgeHealthMonitor = BridgeHealthMonitor;
//# sourceMappingURL=healthMonitor.js.map