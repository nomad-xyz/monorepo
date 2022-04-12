import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import { ethers } from "ethers";

export function getSdk(environment: string): BridgeContext {
    let sdk: BridgeContext;
    if (environment === "production") {
        sdk = new BridgeContext("production");
    } else if (environment === "staging") {
        sdk = new BridgeContext("staging");
    } else if (environment === "development") {
        sdk = new BridgeContext("development");
    } else {
        throw new Error(`Enviroment '${environment}' is not suppoerted`);
    }

    sdk.domainNumbers.forEach((domain: number) => {
        const name = sdk.mustGetDomain(domain).name.toUpperCase();
        const rpcEnvKey = `${name}_RPC`;
        const rpc = process.env[rpcEnvKey];

        if (!rpc)
        throw new Error(
            `RPC url for domain ${domain} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`
        );

        if (rpc.includes(',')) {
            const rpcs = rpc.split(',');
            const providers = rpcs.map(rpc => new ethers.providers.StaticJsonRpcProvider(rpc));
            const provider = new ethers.providers.FallbackProvider(providers, 1);
            sdk.registerProvider(domain, provider);
        } else {
            sdk.registerRpcProvider(domain, rpc);
        }

    });

    return sdk;
}