import { ethers } from "ethers";
import { AwsKmsSignerCredentials } from "./kms";

export type AddressWithThreshold =
  | string
  | { address: string; threshold: ethers.BigNumber };

export function justAddress(a: AddressWithThreshold): string {
  return typeof a === "string" ? a : a.address;
}

export interface AgentAddresses {
  kathy?: AddressWithThreshold;
  watchers: AddressWithThreshold[];
  updater: AddressWithThreshold;
  relayer: AddressWithThreshold;
  processor: AddressWithThreshold;
}

export interface INetwork {
  name: string;
  endpoint: string;
  replicas: string[];
  bank: string | AwsKmsSignerCredentials;
  threshold: ethers.BigNumber;
  watcherThreshold: ethers.BigNumber;
  agents: AgentAddresses;
}

export interface KeymasterConfig {
  networks: INetwork[];
}
