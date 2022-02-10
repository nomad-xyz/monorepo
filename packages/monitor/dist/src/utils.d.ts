import { ethers } from 'ethers';
import { TypedEvent } from '@nomad-xyz/contract-interfaces/core/commons';
declare type Result = ethers.utils.Result;
export declare function getFraudWindowSeconds(network: string): number;
export declare function getTimelagSeconds(network: string): number;
export declare function blocksToSeconds(network: string, blocks: number): number;
export declare function secondsToBlocks(network: string, seconds: number): number;
export declare function compareEvents(a: TypedEvent<Result>, b: TypedEvent<Result>): number;
export {};
//# sourceMappingURL=utils.d.ts.map