"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareEvents = exports.secondsToBlocks = exports.blocksToSeconds = exports.getTimelagSeconds = exports.getFraudWindowSeconds = void 0;
const blockTimesSeconds = new Map([
    ['ethereum', 15],
    ['celo', 5],
    ['polygon', 2],
    ['alfajores', 5],
    ['rinkeby', 15],
    ['kovan', 4],
    ['moonbasealpha', 14],
    ['moonbeam', 14],
]);
const fraudWindowSeconds = new Map([
    ['ethereum', 60 * 60 * 3],
    ['celo', 60 * 15],
    ['polygon', 60 * 15],
    ['alfajores', 10],
    ['rinkeby', 10],
    ['kovan', 10],
    ['moonbasealpha', 10],
    ['moonbeam', 10],
]);
// timelag_blocks * block_time
const timelagsSeconds = new Map([
    ['ethereum', 20 * 15],
    ['celo', 5 * 5],
    ['polygon', 200 * 2],
    ['alfajores', 5 * 5],
    ['rinkeby', 60 * 15],
    ['kovan', 5 * 4],
    ['moonbasealpha', 5 * 15],
    ['moonbeam', 5 * 15],
]);
function getFraudWindowSeconds(network) {
    return fraudWindowSeconds.get(network);
}
exports.getFraudWindowSeconds = getFraudWindowSeconds;
function getTimelagSeconds(network) {
    return timelagsSeconds.get(network);
}
exports.getTimelagSeconds = getTimelagSeconds;
function blocksToSeconds(network, blocks) {
    return blocks * blockTimesSeconds.get(network);
}
exports.blocksToSeconds = blocksToSeconds;
function secondsToBlocks(network, seconds) {
    return seconds / blockTimesSeconds.get(network);
}
exports.secondsToBlocks = secondsToBlocks;
function compareEvents(a, b) {
    if (a.blockNumber < b.blockNumber) {
        return -1;
    }
    else if (a.blockNumber > b.blockNumber) {
        return 1;
    }
    else {
        if (a.transactionIndex < b.transactionIndex) {
            return -1;
        }
        else {
            return 1;
        }
    }
}
exports.compareEvents = compareEvents;
//# sourceMappingURL=utils.js.map