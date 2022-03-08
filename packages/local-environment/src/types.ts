
import {
  BridgeDeploy,
  ExistingBridgeDeploy,
} from "@nomad-xyz/deploy/lib/bridge/BridgeDeploy";

export type Domain = number;
export type Address = string;
export type HexString = string;
export type Deploy = BridgeDeploy | ExistingBridgeDeploy;