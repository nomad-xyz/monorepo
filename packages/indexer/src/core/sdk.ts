import { BridgeContext } from "@nomad-xyz/sdk-bridge";

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

        sdk.registerRpcProvider(domain, rpc);
    });

    return sdk;
}