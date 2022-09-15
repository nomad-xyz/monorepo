import {ethers} from 'ethers';

// export interface EventBase {
//     block: number,
//     transactionHash: string,
//     timestamp: string,
// }

// export interface Dispatch {
//     tag: "dispatch",
//     messageHash: string;
//     leafIndex: ethers.BigNumber;
//     destinationAndNonce: ethers.BigNumber;
//     committedRoot: string;
//     message: string;
// }

// export interface Send {
//     token: string;
//     from: string;
//     toDomain: number;
//     toId: string;
//     amount: ethers.BigNumber;
//     fastLiquidityEnabled: boolean;
// }

// export interface Update {
//     tag: "update",
//     homeDomain: number;
//     oldRoot: string;
//     newRoot: string;
//     signature: string;
// }

// export interface Process {
//     tag: "process",
//     messageHash: string;
//     success: boolean;
//     returnData: string;
// }