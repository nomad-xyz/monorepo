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
const sdk_1 = require("@nomad-xyz/sdk");
const contexts = __importStar(require("./registerContext"));
const print_1 = require("./print");
const input = [
    {
        chain: 'kovan',
        context: contexts.dev,
        transactionHash: '0x39322e91cbfe18391f252f063231065adceda35fe8c1ebd2292c98d0a7d10a1f',
    },
];
traceMany(input).then(() => {
    console.log('DONE!');
});
function traceMany(inputs) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let input of inputs) {
            const { context, chain, transactionHash } = input;
            yield traceTransfer(context, chain, transactionHash);
        }
    });
}
function traceTransfer(context, origin, transactionHash) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Trace ${transactionHash} on ${origin}`);
        const message = yield sdk_1.NomadMessage.singleFromTransactionHash(context, origin, transactionHash);
        console.log(`Leaf Index: ${message.leafIndex}`);
        const status = yield message.events();
        (0, print_1.printStatus)(context, status);
    });
}
//# sourceMappingURL=trace.js.map