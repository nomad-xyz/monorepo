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
exports.Script = void 0;
const config_1 = require("./config");
const relayerMonitor_1 = require("./latencies/relayer/relayerMonitor");
const processorMonitor_1 = require("./latencies/processor/processorMonitor");
const healthMonitor_1 = require("./bridgeHealth/healthMonitor");
const e2eMonitor_1 = require("./latencies/e2e/e2eMonitor");
var Script;
(function (Script) {
    Script["Health"] = "health";
    Script["Relayer"] = "relayer";
    Script["Processor"] = "processor";
    Script["E2E"] = "e2e";
})(Script = exports.Script || (exports.Script = {}));
const args = process.argv.slice(2);
const script = args[0];
const origin = args[1];
(() => __awaiter(void 0, void 0, void 0, function* () {
    const config = new config_1.MonitorConfig(script, origin);
    switch (script) {
        case Script.Health:
            yield new healthMonitor_1.BridgeHealthMonitor(config).main();
            break;
        case Script.E2E:
            yield new e2eMonitor_1.E2ELatencyMonitor(config).main();
            break;
        case Script.Relayer:
            yield new relayerMonitor_1.RelayLatencyMonitor(config).main();
            break;
        case Script.Processor:
            yield new processorMonitor_1.ProcessorLatencyMonitor(config).main();
            break;
        default:
            throw new Error(`Undefined script found: ${script}`);
    }
}))();
//# sourceMappingURL=run.js.map