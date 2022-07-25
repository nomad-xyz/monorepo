import { ethers } from "ethers";
import { AwsKmsSignerCredentials } from "./kms";

export type AddressWithThreshold =
  | string
  | { address: string; threshold: ethers.BigNumber };

export function justAddress(a: AddressWithThreshold): string {
  return typeof a === "string" ? a : a.address;
}

export enum AgentRole {
  Updater = "updater",
  Relayer = "relayer",
  Processor = "processor",
  Watcher = "watcher",
  Kathy = "kathy",
}

export interface AgentAddresses {
  kathy?: AddressWithThreshold;
  watchers: AddressWithThreshold[];
  updater: AddressWithThreshold;
  relayer: AddressWithThreshold;
  processor: AddressWithThreshold;
}

export interface Ignores {
  all?: AgentRole[];
  local?: AgentRole[];
  remote?: AgentRole[];
}

export interface INetwork {
  name: string;
  endpoint: string;
  replicas: string[];
  bank: string | AwsKmsSignerCredentials;
  threshold: ethers.BigNumber;
  watcherThreshold: ethers.BigNumber;
  agents: AgentAddresses;
  ignore?: Ignores;
}

export interface KeymasterConfig {
  networks: INetwork[];
}

export function allowAgent(
  n: INetwork,
  where: "local" | "remote",
  role: AgentRole
) {
  if (!n.ignore) return true;
  if (n.ignore.all?.includes(role)) return false;

  if (where === "local") {
    return !n.ignore.local?.includes(role);
  } else {
    return !n.ignore.remote?.includes(role);
  }
}
