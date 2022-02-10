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
// import * as contexts from "./registerContext";
// import config from './config';
//import { ethereum } from '@nomad-xyz/sdk/nomad/domains/mainnet';
const ethers_1 = require("ethers");
const moment_1 = __importDefault(require("moment"));
const nodeplotlib_1 = require("nodeplotlib");
const agent_addresses = {
    celo: {
        addresses: {
            relayer: "0x8fe96fF47e0e253BF69487f36338eFB626B9ff7A",
            processor: "0xae6e2e17f7A42500A51E6b3d6e7C15D21ef44EA7"
        }
    },
    ethereum: {
        addresses: {
            updater: "0x21Da13c7748EE755bE4bd0E00C31F2b2edaFa57c",
            relayer: "0x1fdA806A25d8B0baB1f67aE32C1c835f36c804D4",
            processor: "0x673C737422b5f87B3e04Bb430699caC04aFAD760"
        }
    },
    polygon: {
        addresses: {
            relayer: "0x9b1ac3fb35DbAE3aA929Bcc9f21aa1bE40D0480f",
            processor: "0xBB0FD28512B95FF1F50fAe191e1368E5E4a07261"
        }
    }
};
let etherscan = new ethers_1.ethers.providers.EtherscanProvider('mainnet', 'J67H9DCRPSHVWEFTP3JNG1VP81PIM8R7UV');
let provider = new ethers_1.ethers.providers.AlchemyProvider('mainnet', '6mbHDw-N9UOlEu_3yOvBcrzeUoUN8f_W');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const plots = [];
        let globalFirstTx = undefined;
        let globalLastTx = undefined;
        const agent_txs = {};
        // Fetch txs and search for earliest and latest txs 
        for (let agent of Object.keys(agent_addresses.ethereum.addresses)) {
            const address = agent_addresses.ethereum.addresses[agent];
            const history = yield etherscan.getHistory(address);
            console.log(`Got ${history.length} txs for ${agent} - ${address}`);
            //ethereum_agent_txs[agent] = history
            const firstTx = history[0];
            const lastTx = history.at(-1);
            if (globalFirstTx === undefined || firstTx.timestamp < globalFirstTx.timestamp) {
                //console.log("Replaced ", globalFirstTx, " with ", firstTx)
                globalFirstTx = firstTx;
            }
            if (globalLastTx === undefined || lastTx.timestamp > globalLastTx.timestamp) {
                globalLastTx = lastTx;
            }
            agent_txs[`Ethereum: ${agent}`] = history;
        }
        for (let agent of Object.keys(agent_addresses.celo.addresses)) {
            const address = agent_addresses.celo.addresses[agent];
            const history = yield etherscan.getHistory(address);
            console.log(`Got ${history.length} txs for ${agent} - ${address}`);
            //ethereum_agent_txs[agent] = history
            const firstTx = history[0];
            const lastTx = history.at(-1);
            if (globalFirstTx === undefined || firstTx.timestamp < globalFirstTx.timestamp) {
                //console.log("Replaced ", globalFirstTx, " with ", firstTx)
                globalFirstTx = firstTx;
            }
            if (globalLastTx === undefined || lastTx.timestamp > globalLastTx.timestamp) {
                globalLastTx = lastTx;
            }
            agent_txs[`Celo: ${agent}`] = history;
        }
        for (let agent of Object.keys(agent_addresses.polygon.addresses)) {
            const address = agent_addresses.polygon.addresses[agent];
            const history = yield etherscan.getHistory(address);
            console.log(`Got ${history.length} txs for ${agent} - ${address}`);
            //ethereum_agent_txs[agent] = history
            const firstTx = history[0];
            const lastTx = history.at(-1);
            if (globalFirstTx === undefined || firstTx.timestamp < globalFirstTx.timestamp) {
                //console.log("Replaced ", globalFirstTx, " with ", firstTx)
                globalFirstTx = firstTx;
            }
            if (globalLastTx === undefined || lastTx.timestamp > globalLastTx.timestamp) {
                globalLastTx = lastTx;
            }
            agent_txs[`Polygon: ${agent}`] = history;
        }
        const globalFirstTime = (0, moment_1.default)(globalFirstTx.timestamp * 1000);
        const globalLastTime = (0, moment_1.default)(globalLastTx.timestamp * 1000);
        // compute difference in days to get nBuckets 
        let difference = Math.abs(globalLastTime.valueOf() - globalFirstTime.valueOf());
        let dayDiff = Math.ceil(difference / (1000 * 3600 * 24)) + 1;
        // // (labels) make array of date labels starting from first timestamp (nBuckets long)
        const labelArray = new Array();
        const currentDay = globalFirstTime.clone();
        while (labelArray.length < dayDiff) {
            labelArray.push(currentDay.format('MMMM Do, YYYY'));
            currentDay.add(1, 'day');
        }
        for (let key of Object.keys(agent_txs)) {
            console.log(`Building plot for ${key}`);
            const history = agent_txs[key];
            // (fees) make array of zeros that is nBuckets long 
            const gasArray = new Array(dayDiff).fill(ethers_1.BigNumber.from(0));
            // for each transaction, sum fee with value in correct date slot based on timestamp 
            const promises = history.map((tx) => __awaiter(this, void 0, void 0, function* () {
                const receipt = yield provider.getTransactionReceipt(tx.hash);
                return {
                    tx: tx,
                    receipt: receipt
                };
            }));
            const receipts = yield Promise.all(promises);
            for (let map of receipts) {
                const gas = map.receipt.effectiveGasPrice.mul(map.receipt.gasUsed);
                const txTime = (0, moment_1.default)(map.tx.timestamp * 1000);
                const diff = Math.abs(txTime.valueOf() - globalFirstTime.valueOf());
                const index = Math.ceil(diff / (1000 * 3600 * 24));
                gasArray[index] = gasArray[index].add(gas);
            }
            const etherArray = gasArray.map((entry) => { return ethers_1.ethers.utils.formatEther(entry); });
            // plot it 
            const plotData = {
                x: labelArray,
                y: etherArray,
                type: 'scatter',
                name: `ETH Gas Spend - ${key}`
            };
            plots.push(plotData);
        }
        (0, nodeplotlib_1.plot)(plots);
    });
}
main();
// process ethereum
// for each address
// get list of transactions 
// process polygon
// process celo 
// for each networ
// get a list of transactions
// for each chunk in transactions, skip 100 for each chunk
// for each transaction in chunk
//# sourceMappingURL=gas.js.map