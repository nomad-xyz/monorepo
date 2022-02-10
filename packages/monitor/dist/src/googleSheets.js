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
exports.uploadDeployedTokens = void 0;
const google_spreadsheet_1 = require("google-spreadsheet");
const fs_1 = __importDefault(require("fs"));
function uniqueTokens(details) {
    const tokens = details.map((details) => {
        const { token: { name, symbol, decimals }, event: { args: { domain, id, representation }, }, } = details;
        return {
            name,
            symbol,
            decimals,
            address: representation,
            id,
            domain,
        };
    });
    return [...new Set(tokens)];
}
// https://www.npmjs.com/package/google-spreadsheet
function uploadDeployedTokens(network, deploys, credentialsFile = './credentials.json') {
    var _a, _b, _c, _d, _e, _f;
    return __awaiter(this, void 0, void 0, function* () {
        const credentials = JSON.parse(fs_1.default.readFileSync(credentialsFile, 'utf8'));
        // Production Spreadsheet ID: 1RooLLPTtvFaiiiuJH381fcRRgGTajv7w973xUThy5-4
        // Development Spreadsheet ID: 1AApo2bkGdCRN2w6CJYRF_rIkEnrIt1Ab4C_YZ_FnSn8
        const doc = new google_spreadsheet_1.GoogleSpreadsheet('1AApo2bkGdCRN2w6CJYRF_rIkEnrIt1Ab4C_YZ_FnSn8');
        yield doc.useServiceAccountAuth(credentials);
        yield doc.loadInfo();
        const uniques = uniqueTokens(deploys);
        let sheet;
        if (doc.sheetsByTitle.hasOwnProperty(network)) {
            sheet = doc.sheetsByTitle[network];
        }
        else {
            sheet = yield doc.addSheet({
                title: network,
                headerValues: ['name', 'symbol', 'decimals', 'address', 'id', 'domain'],
            });
        }
        let rows = yield sheet.getRows();
        for (const token of uniques) {
            const matchedRow = rows.findIndex((element) => element.address === token.address);
            if (matchedRow != -1) {
                let row = rows[matchedRow];
                row.name = (_a = token.name) !== null && _a !== void 0 ? _a : 'undefined';
                row.symbol = (_b = token.symbol) !== null && _b !== void 0 ? _b : 'undefined';
                row.decimals = (_c = token.decimals) !== null && _c !== void 0 ? _c : 'undefined';
                row.save();
            }
            else {
                yield sheet.addRow({
                    name: (_d = token.name) !== null && _d !== void 0 ? _d : 'undefined',
                    symbol: (_e = token.symbol) !== null && _e !== void 0 ? _e : 'undefined',
                    decimals: (_f = token.decimals) !== null && _f !== void 0 ? _f : 'undefined',
                    address: token.address,
                    id: token.id,
                    domain: token.domain,
                });
            }
        }
    });
}
exports.uploadDeployedTokens = uploadDeployedTokens;
//# sourceMappingURL=googleSheets.js.map