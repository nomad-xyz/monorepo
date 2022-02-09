import { Domain } from '@nomad-xyz/multi-provider';

type Address = string;

export interface NomadDomain extends Domain {
  bridgeRouter: Address;
  tokenRegistry: Address;
  ethHelper?: Address;
  home: Address;
  replicas: ReplicaInfo[];
  governanceRouter: Address;
  xAppConnectionManager: Address;
  safeService?: string;
}

export interface ReplicaInfo {
  domain: number;
  address: Address;
}
