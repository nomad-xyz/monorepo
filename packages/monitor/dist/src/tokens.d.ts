import { AnnotatedSend, AnnotatedTokenDeployed } from '@nomad-xyz/sdk/nomad/events/bridgeEvents';
import { NomadContext } from '@nomad-xyz/sdk/nomad';
export declare type TokenDetails = {
    name: string;
    symbol: string;
    decimals: number;
};
export declare type Deploy = AnnotatedTokenDeployed & {
    token: TokenDetails;
};
export declare type Send = AnnotatedSend & {
    token: TokenDetails;
};
export declare function getDomainDeployedTokens(context: NomadContext, nameOrDomain: string | number): Promise<Deploy[]>;
export declare function getDeployedTokens(context: NomadContext): Promise<Map<number, Deploy[]>>;
export declare function printDeployedTokens(context: NomadContext): Promise<void>;
export declare function persistDeployedTokens(context: NomadContext, credentials: string): Promise<void>;
//# sourceMappingURL=tokens.d.ts.map