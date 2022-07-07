export type Address = string;
export type Domain = string | number;

export type GovernanceConfig = {
  governor: Address
  modules: any
}

export type Call = {
  to: Address
  value: Number
  data: String
}

export type Proposal = { 
  module: {
    domain: Domain
    address: Address
  }
  calls: Call[]
}

// example governanceConfig
export const governanceConfig: GovernanceConfig = {
  governor: '0x00',
  modules: {
    1001: '0x00',
    3001: '0x00',
    4001: '0x00',
    5001: '0x00',
    6661: '0x00'
  }
}

// 1001, 3001, 4001, 5001, 6661
