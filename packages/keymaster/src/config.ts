import { ethers } from "ethers"

export interface AgentAddresses {
    kathy?: string,
    watchers?: string[],
    updater?: string,
    relayer: string,
    processor: string,
}

export interface Network {
    endpoint: string,
    bank: string,
    treshold: ethers.BigNumberish,
    // replicas: string[],
    agents: AgentAddresses,
}

export interface KeymasterConfig {
    // environment: string,
    networks: Record<string, Network>
}

// interface 