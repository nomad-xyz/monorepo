"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dev = exports.staging = exports.mainnet = exports.setRpcProviders = void 0;
const sdk_1 = require("@nomad-xyz/sdk");
Object.defineProperty(exports, "dev", { enumerable: true, get: function () { return sdk_1.dev; } });
Object.defineProperty(exports, "mainnet", { enumerable: true, get: function () { return sdk_1.mainnet; } });
Object.defineProperty(exports, "staging", { enumerable: true, get: function () { return sdk_1.staging; } });
function setRpcProviders(rpcs) {
    // register mainnet
    sdk_1.mainnet.registerRpcProvider('ethereum', rpcs.ethereumRpc);
    sdk_1.mainnet.registerRpcProvider('moonbeam', rpcs.moonbeamRpc);
    // register staging
    sdk_1.staging.registerRpcProvider('moonbasealpha', rpcs.moonbasealphaRpc);
    sdk_1.staging.registerRpcProvider('kovan', rpcs.kovanRpc);
    // register dev
    sdk_1.dev.registerRpcProvider('kovan', rpcs.kovanRpc);
    sdk_1.dev.registerRpcProvider('moonbasealpha', rpcs.moonbasealphaRpc);
}
exports.setRpcProviders = setRpcProviders;
//# sourceMappingURL=registerContext.js.map