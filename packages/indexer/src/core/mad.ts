import { TypedEvent } from "@nomad-xyz/contracts-bridge/dist/src/common";
import { Annotated, NomadContext, NomadMessage } from "@nomad-xyz/sdk";
import { ethers } from "ethers";
import { Result } from "ethers/lib/utils";
import { retry } from "./utils";

async function wrap() {
    
}

export class MadMessage<T extends NomadContext> {
    m: NomadMessage<T>;
    blockNumber: number;
    timestamp: number;
    constructor(m: NomadMessage<T>, blockNumber: number, timestamp: number) {
        this.m = m;
        this.blockNumber = blockNumber;
        this.timestamp = timestamp;
    }

    static async fromNomadMessage<T extends NomadContext>(m: NomadMessage<T>): Promise<MadMessage<T>> {
        const provider = m.context.mustGetProvider(m.origin);
        // await retry(async () => {

        // }, 5, async () => {
            
        // })
        const transaction = await provider.getTransaction(m.receipt.transactionHash);
        const {blockNumber, timestamp, } = transaction;
        return new MadMessage(m, blockNumber!, timestamp!);
    }
}

export class MadEvent<U extends Result, T extends TypedEvent<U>, E extends Annotated<U,T>> {
    event: E;
    blockNumber: number;
    timestamp: number;
    constructor(event: E, blockNumber: number, timestamp: number) {
        this.event = event;
        this.blockNumber = blockNumber;
        this.timestamp = timestamp;
    }

    static async withProvider<U extends Result, T extends TypedEvent<U>, E extends Annotated<U,T>>(event: E, provider: ethers.providers.Provider): Promise<MadEvent<U,T,E>> {
        const transaction = await provider.getTransaction(event.event.transactionHash);
        const {blockNumber, timestamp, } = transaction;
        return new MadEvent(event, blockNumber!, timestamp!);
    }

    unique(): string {
        return this.event.transactionHash
    }
}