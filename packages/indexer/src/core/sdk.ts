import { BridgeContext } from "@nomad-xyz/sdk-bridge";
import { NomadContext } from "@nomad-xyz/sdk";

export type NomadEnvironment = "development" | "staging" | "production";
const environment = process.env.ENVIRONMENT! as NomadEnvironment;

export function getBC(): BridgeContext {
    return getBridgeContext(environment)
}

export function getNC(): NomadContext {
    return getNomadContext(environment)
}

export function getBridgeContext(environment: string): BridgeContext {
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

export function getNomadContext(environment: string): NomadContext {
    let sdk: NomadContext;
    if (environment === "production") {
        sdk = new NomadContext("production");
    } else if (environment === "staging") {
        sdk = new NomadContext("staging");
    } else if (environment === "development") {
        sdk = new NomadContext("development");
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

export function getSDKs(environment: string): [NomadContext, BridgeContext] {
    let sdk: [NomadContext, BridgeContext];
    if (environment === "production") {
        sdk = [new NomadContext("production"), new BridgeContext("production")];
    } else if (environment === "staging") {
        sdk = [new NomadContext("staging"), new BridgeContext("staging")];
    } else if (environment === "development") {
        sdk = [new NomadContext("development"), new BridgeContext("development")];
    } else {
        throw new Error(`Enviroment '${environment}' is not suppoerted`);
    }

    sdk[0].domainNumbers.forEach((domain: number) => {
        const name = sdk[0].mustGetDomain(domain).name.toUpperCase();
        const rpcEnvKey = `${name}_RPC`;
        const rpc = process.env[rpcEnvKey];

        if (!rpc)
        throw new Error(
            `RPC url for domain ${domain} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`
        );

        sdk[0].registerRpcProvider(domain, rpc);
        sdk[1].registerRpcProvider(domain, rpc);
    });

    return sdk;
}