"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonitorMetrics = exports.writeUnprocessedMessages = exports.printStatus = exports.STATUS_TO_STRING = exports.blockExplorerURL = void 0;
const nomad_1 = require("@nomad-xyz/sdk/nomad");
const fs_1 = __importDefault(require("fs"));
function blockExplorerURL(domainName, transactionHash) {
    switch (domainName) {
        case 'celo':
            return `https://explorer.celo.org/tx/${transactionHash}`;
        case 'ethereum':
            return `https://etherscan.io/tx/${transactionHash}`;
        case 'polygon':
            return `https://polygonscan.com/tx/${transactionHash}`;
    }
    return undefined;
}
exports.blockExplorerURL = blockExplorerURL;
exports.STATUS_TO_STRING = {
    [nomad_1.MessageStatus.Dispatched]: 'Dispatched on Home',
    [nomad_1.MessageStatus.Included]: 'Included in Home Update',
    [nomad_1.MessageStatus.Relayed]: 'Relayed to Replica',
    [nomad_1.MessageStatus.Processed]: 'Processed',
};
function quietEvent(context, lifecyleEvent) {
    const { domain, receipt } = lifecyleEvent;
    const domainName = context.resolveDomainName(domain);
    if (!domainName) {
        throw new Error('I have no name');
    }
    return {
        event: lifecyleEvent.eventName,
        domainName,
        url: blockExplorerURL(domainName, receipt.transactionHash),
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
    };
}
function printStatus(context, nomadStatus) {
    const { status, events } = nomadStatus;
    const printable = {
        status: exports.STATUS_TO_STRING[status],
        events: events.map((event) => quietEvent(context, event)),
    };
    console.log(JSON.stringify(printable, null, 2));
}
exports.printStatus = printStatus;
function writeUnprocessedMessages(unprocessedDetails, origin) {
    fs_1.default.mkdirSync('unprocessed', { recursive: true });
    fs_1.default.writeFileSync(`unprocessed/${origin}.json`, JSON.stringify(unprocessedDetails, null, 2));
}
exports.writeUnprocessedMessages = writeUnprocessedMessages;
function getMonitorMetrics(origin, dispatchLogs, processedLogs, unprocessedDetails) {
    const oldest = unprocessedDetails.length != 0
        ? blockExplorerURL(unprocessedDetails[0].chain, unprocessedDetails[0].transactionHash)
        : '';
    return {
        summary: {
            network: origin,
            dispatched: dispatchLogs.length,
            processed: processedLogs.length,
            unprocessed: unprocessedDetails.length,
            oldest,
        },
    };
}
exports.getMonitorMetrics = getMonitorMetrics;
//# sourceMappingURL=print.js.map