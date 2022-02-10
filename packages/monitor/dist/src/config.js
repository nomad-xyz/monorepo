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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildConfig = exports.prepareContext = exports.getRpcsFromEnv = exports.MonitorConfig = void 0;
const dotenv = __importStar(require("dotenv"));
const bunyan_1 = __importDefault(require("bunyan"));
const contexts = __importStar(require("./registerContext"));
const healthMetrics_1 = require("./bridgeHealth/healthMetrics");
const registerContext_1 = require("./registerContext");
const metrics_1 = require("./latencies/relayer/metrics");
const metrics_2 = require("./latencies/processor/metrics");
const metrics_3 = require("./latencies/e2e/metrics");
dotenv.config({ path: (_a = process.env.CONFIG_PATH) !== null && _a !== void 0 ? _a : '.env' });
const environment = (_b = process.env.ENVIRONMENT) !== null && _b !== void 0 ? _b : 'development';
class MonitorConfig {
    constructor(script, origin) {
        var _a, _b;
        prepareContext();
        const environment = (_a = process.env.ENVIRONMENT) !== null && _a !== void 0 ? _a : 'development';
        this.origin = origin;
        this.remotes = getNetworks().filter((m) => m != origin);
        switch (environment) {
            case 'production': {
                this.context = contexts.mainnet;
                break;
            }
            case 'staging': {
                this.context = contexts.staging;
                break;
            }
            default: {
                this.context = contexts.dev;
                break;
            }
        }
        this.metrics = getMetrics(script);
        this.logger = createLogger(script);
        this.googleCredentialsFile =
            (_b = process.env.GOOGLE_CREDENTIALS_FILE) !== null && _b !== void 0 ? _b : './credentials.json';
    }
}
exports.MonitorConfig = MonitorConfig;
function createLogger(script) {
    return bunyan_1.default.createLogger({
        name: `contract-metrics-${script}`,
        serializers: bunyan_1.default.stdSerializers,
        level: 'debug',
        environment: environment,
    });
}
function getMetrics(script) {
    let metrics;
    switch (script) {
        case 'health':
            metrics = new healthMetrics_1.HealthMetricsCollector(environment, createLogger(script));
            break;
        case 'e2e':
            metrics = new metrics_3.E2ELatencyMetrics(environment, createLogger(script));
            break;
        case 'relayer':
            metrics = new metrics_1.RelayLatencyMetrics(environment, createLogger(script));
            break;
        case 'processor':
            metrics = new metrics_2.ProcessLatencyMetrics(environment, createLogger(script));
            break;
        case 'tokens':
            metrics = undefined;
            break;
        default:
            throw new Error('Must define a monitor script to run!');
    }
    return metrics;
}
function getNetworks() {
    let networks = [];
    switch (environment) {
        case 'production':
            networks = ['ethereum', 'moonbeam'];
            break;
        case 'staging':
            networks = ['kovan', 'moonbasealpha'];
            break;
        default:
            networks = ['kovan', 'moonbasealpha'];
            break;
    }
    return networks;
}
function getRpcsFromEnv() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return {
        celoRpc: (_a = process.env.CELO_RPC) !== null && _a !== void 0 ? _a : '',
        ethereumRpc: (_b = process.env.ETHEREUM_RPC) !== null && _b !== void 0 ? _b : '',
        polygonRpc: (_c = process.env.POLYGON_RPC) !== null && _c !== void 0 ? _c : '',
        alfajoresRpc: (_d = process.env.ALFAJORES_RPC) !== null && _d !== void 0 ? _d : '',
        kovanRpc: (_e = process.env.KOVAN_RPC) !== null && _e !== void 0 ? _e : '',
        rinkebyRpc: (_f = process.env.RINKEBY_RPC) !== null && _f !== void 0 ? _f : '',
        moonbasealphaRpc: (_g = process.env.MOONBASEALPHA_RPC) !== null && _g !== void 0 ? _g : '',
        moonbeamRpc: (_h = process.env.MOONBEAM_RPC) !== null && _h !== void 0 ? _h : ''
    };
}
exports.getRpcsFromEnv = getRpcsFromEnv;
function prepareContext() {
    const rpcs = getRpcsFromEnv();
    (0, registerContext_1.setRpcProviders)(rpcs);
}
exports.prepareContext = prepareContext;
function buildConfig(script) {
    var _a;
    prepareContext();
    return {
        baseLogger: createLogger(script),
        metrics: getMetrics(script),
        networks: getNetworks(),
        environment: environment,
        googleCredentialsFile: (_a = process.env.GOOGLE_CREDENTIALS_FILE) !== null && _a !== void 0 ? _a : './credentials.json',
    };
}
exports.buildConfig = buildConfig;
//# sourceMappingURL=config.js.map