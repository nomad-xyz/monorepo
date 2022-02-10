"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const fetch_1 = require("@nomad-xyz/sdk/nomad/events/fetch");
const contexts = __importStar(require("../registerContext"));
const print_1 = require("../print");
const config_1 = require("../config");
const config = (0, config_1.buildConfig)('health');
const cliArgs = process.argv.slice(2);
switch (cliArgs[0]) {
    case 'once':
        main(false);
        break;
    default:
        main(true);
        break;
}
function main(forever) {
    return __awaiter(this, void 0, void 0, function* () {
        if (forever) {
            config.metrics.startServer(9090);
        }
        do {
            // write results to disk if we're not running forever
            yield monitorAll(!forever);
            if (forever) {
                config.baseLogger.info('Sleeping for 120 seconds.');
                yield new Promise((resolve) => setTimeout(resolve, 120000));
            }
        } while (forever);
    });
}
function monitorAll(shouldWrite) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let network of config.networks) {
            const origin = network;
            const remotes = config.networks.filter((m) => m != origin);
            let cont;
            switch (config.environment) {
                case 'production': {
                    cont = contexts.mainnet;
                    break;
                }
                case 'staging': {
                    cont = contexts.staging;
                    break;
                }
                default: {
                    cont = contexts.dev;
                    break;
                }
            }
            try {
                yield monitor(cont, origin, remotes, shouldWrite);
            }
            catch (e) {
                config.baseLogger.error({ error: e }, `Encountered an Error while processing ${origin}!`);
                continue;
            }
        }
    });
}
function monitor(context, origin, remotes, shouldWrite) {
    return __awaiter(this, void 0, void 0, function* () {
        config.baseLogger.info(`Checking ${origin}`);
        config.baseLogger.info(`Get Dispatch logs from ${origin}`);
        const home = context.mustGetCore(origin).home;
        const dispatchFilter = home.filters.Dispatch();
        const dispatchLogs = yield (0, fetch_1.getEvents)(context, origin, home, dispatchFilter);
        const processedLogs = [];
        for (let remote of remotes) {
            config.baseLogger.info(`Get Process logs from ${remote} for ${origin}`);
            const replica = context.mustGetReplicaFor(origin, remote);
            const processFilter = replica.filters.Process();
            const processLogs = yield (0, fetch_1.getEvents)(context, remote, replica, processFilter);
            processedLogs.push(...processLogs);
            config.baseLogger.info(`Successfully got Process logs from ${remote} for ${origin}. Length ${processLogs.length}`);
        }
        const unprocessedDetails = yield getUnprocessedDetails(origin, dispatchLogs, processedLogs);
        const summary = (0, print_1.getMonitorMetrics)(origin, dispatchLogs, processedLogs, unprocessedDetails);
        config.baseLogger.info(summary);
        config.metrics.setBridgeState(origin, dispatchLogs.length, processedLogs.length, unprocessedDetails.length);
        // write details to file
        yield (0, print_1.writeUnprocessedMessages)(unprocessedDetails, origin);
    });
}
function getUnprocessedDetails(origin, dispatchLogs, processedLogs) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
//# sourceMappingURL=monitor.js.map