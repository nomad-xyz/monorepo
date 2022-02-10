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
exports.persistDeployedTokens = exports.printDeployedTokens = exports.getDeployedTokens = exports.getDomainDeployedTokens = void 0;
const registerContext_1 = require("./registerContext");
const config_1 = require("./config");
const nomad_1 = require("@nomad-xyz/sdk/nomad");
const googleSheets_1 = require("./googleSheets");
function getDomainDeployedTokens(context, nameOrDomain) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const domain = context.resolveDomain(nameOrDomain);
        const registry = context.mustGetBridge(domain).tokenRegistry;
        // get Send events
        const annotated = yield (0, nomad_1.queryAnnotatedEvents)(context, domain, registry, registry.filters.TokenDeployed(), (_a = context.mustGetDomain(domain).paginate) === null || _a === void 0 ? void 0 : _a.from);
        return yield Promise.all(annotated.map((e) => __awaiter(this, void 0, void 0, function* () {
            const deploy = e;
            const erc20 = yield context.resolveCanonicalToken(domain, deploy.event.args.representation);
            const [name, symbol, decimals] = yield Promise.all([
                erc20.name(),
                erc20.symbol(),
                erc20.decimals(),
            ]);
            deploy.token = {};
            deploy.token.name = name;
            deploy.token.symbol = symbol;
            deploy.token.decimals = decimals;
            return deploy;
        })));
    });
}
exports.getDomainDeployedTokens = getDomainDeployedTokens;
function getDeployedTokens(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const events = new Map();
        for (const domain of context.domainNumbers) {
            events.set(domain, yield getDomainDeployedTokens(context, domain));
        }
        return events;
    });
}
exports.getDeployedTokens = getDeployedTokens;
function prettyDeploy(context, deploy) {
    const { event: { args: { domain, id, representation }, }, token: { name, symbol, decimals }, } = deploy;
    return { domain, id, representation, name, symbol, decimals };
}
function printDeployedTokens(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const deployed = yield getDeployedTokens(context);
        for (const [key, value] of deployed.entries()) {
            const trimmed = value.map((deploy) => prettyDeploy(context, deploy));
            console.log(`DOMAIN: ${key} ${context.resolveDomainName(key)}`);
            console.table(trimmed);
        }
    });
}
exports.printDeployedTokens = printDeployedTokens;
function persistDeployedTokens(context, credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        const deployed = yield getDeployedTokens(context);
        for (let domain of deployed.keys()) {
            let domainName = context.resolveDomainName(domain);
            const tokens = deployed.get(domain);
            (0, googleSheets_1.uploadDeployedTokens)(domainName, tokens, credentials);
        }
    });
}
exports.persistDeployedTokens = persistDeployedTokens;
(function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const config = (0, config_1.buildConfig)("tokens");
        yield persistDeployedTokens(registerContext_1.dev, config.googleCredentialsFile);
    });
})();
//# sourceMappingURL=tokens.js.map