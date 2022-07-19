import { ethers } from "ethers";

export type Address = string;
export type Domain = string | number;
export type Locator = {
  domain: Domain;
  id: Address;
};

export type GovernanceConfig = {
  governor: Locator;
  modules: Record<number, string>;
};

export type Call = {
  to: Address;
  value: number;
  data: string;
  operation: 0 | 1;
};

export type Proposal = {
  module: {
    domain: Domain;
    address: Address;
  };
  calls: Call; // TODO: support array of calls?
};

export type CallData = {
  to: ethers.Contract; // Nomad Home contract
  data: ethers.PopulatedTransaction; // dispatch
  message: ethers.BytesLike; // abi.encoded function data for Gnosis module
};
