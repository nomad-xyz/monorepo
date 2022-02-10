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
const dotenv = __importStar(require("dotenv"));
const ethers_1 = require("ethers");
const bridge_1 = require("@nomad-xyz/contract-interfaces/bridge");
// TODO: move to common file
function getRpcProviderFromNetwork(network) {
    let rpcUrl;
    switch (network) {
        case 'ethereum':
            rpcUrl = process.env.ETHEREUM_RPC;
            break;
        case 'moonbeam':
            rpcUrl = process.env.MOONBEAM_RPC;
            break;
        case 'moonbasealpha':
            rpcUrl = process.env.MOONBASEALPHA_RPC;
            break;
        default:
            throw new Error(`No RPC url for network ${network}`);
    }
    return new ethers_1.ethers.providers.JsonRpcProvider(rpcUrl);
}
function getSigner(network) {
    const privKey = process.env.SET_DETAILS_KEY;
    const provider = getRpcProviderFromNetwork(network);
    return new ethers_1.ethers.Wallet(privKey, provider);
}
function setDetailsForToken(network, signer, details) {
    return __awaiter(this, void 0, void 0, function* () {
        const { address, name, symbol, decimals } = details;
        const token = bridge_1.BridgeToken__factory.connect(address, signer);
        console.log('Calling set details on contract...');
        const tx = yield token.setDetails(name, symbol, decimals);
        console.log('Waiting for 3 confirmations...');
        yield tx.wait(3);
        console.log('Successfully set details for token!');
        console.log(`- network: ${network}`);
        console.log(`- address: ${address}`);
        console.log(`- name: ${name}`);
        console.log(`- symbol: ${symbol}`);
        console.log(`- decimals: ${decimals}`);
        console.log(`\n Transaction hash: ${tx.hash}`);
    });
}
/* Usage:
 * 1. set SET_DETAILS_KEY in .env file (as well as RPC urls)
 * 2. npm run set-details <network> <token_address> <token_name> <symbol> <decimals>
 */
(() => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    dotenv.config({ path: (_a = process.env.CONFIG_PATH) !== null && _a !== void 0 ? _a : '.env' });
    const args = process.argv.slice(2);
    const network = args[0];
    const address = args[1];
    const name = args[2];
    const symbol = args[3];
    const decimals = parseInt(args[4]);
    const signer = getSigner(network);
    const details = {
        address,
        name,
        symbol,
        decimals,
    };
    yield setDetailsForToken(network, signer, details);
}))();
//# sourceMappingURL=setDetails.js.map