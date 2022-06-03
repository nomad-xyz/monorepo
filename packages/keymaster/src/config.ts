import { ethers } from "ethers"

export interface AgentAddresses {
    kathy?: string,
    watchers: string[],
    updater: string,
    relayer: string,
    processor: string,
}

export interface INetwork {
    name: string,
    endpoint: string,
    replicas: string[],
    bank: string,
    treshold: ethers.BigNumber,
    agents: AgentAddresses,
}

export interface KeymasterConfig {
    networks: Record<string, INetwork>
}