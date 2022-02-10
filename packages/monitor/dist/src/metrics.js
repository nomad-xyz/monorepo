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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
const prom_client_1 = require("prom-client");
const express_1 = __importDefault(require("express"));
class MetricsCollector {
    constructor(environment, logger) {
        this.environment = environment;
        this.logger = logger;
    }
    /**
     * Starts a server that exposes metrics in the prometheus format
     */
    startServer(port) {
        if (!Number.isInteger(port) || port <= 0 || port > 65535) {
            throw Error(`Invalid PrometheusPort value: ${port}`);
        }
        const server = (0, express_1.default)();
        server.get('/metrics', (_, res) => __awaiter(this, void 0, void 0, function* () {
            res.set('Content-Type', prom_client_1.register.contentType);
            res.end(yield prom_client_1.register.metrics());
        }));
        this.logger.info({
            endpoint: `http://0.0.0.0:${port}/metrics`,
        }, 'Prometheus metrics exposed');
        server.listen(port);
    }
}
exports.MetricsCollector = MetricsCollector;
//# sourceMappingURL=metrics.js.map