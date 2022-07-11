import { ethers } from "ethers";

export type Address = string;
export type Domain = string | number;

export type GovernanceConfig = {
  governor: Address
  modules: Record<number, string>
}

export type Call = {
  to: Address
  value: number
  data: string
  operation: 0 | 1
}

export type Proposal = { 
  module: {
    domain: Domain
    address: Address
  }
  calls: Call // TODO: support array of calls?
}

export type CallData = {
  to: ethers.Contract // Nomad Home contract 
  data: ethers.PopulatedTransaction // dispatch
  message: ethers.BytesLike // abi.encoded function data for Gnosis module
}

// example governanceConfig
export const governanceConfig: GovernanceConfig = {
  governor: '0x00',
  modules: {
    1001: '0x00',
    3001: '0x00',
    4001: '0x00',
    5001: '0x00',
    // 6661: '0x00',
  },
};

// 1001, 3001, 4001, 5001, 6661
