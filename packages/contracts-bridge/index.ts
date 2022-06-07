/* tslint:disable */
/* eslint-disable */
export type { BridgeRouter } from "./src/BridgeRouter";
export type { BridgeToken } from "./src/BridgeToken";
export type { ETHHelper } from "./src/ETHHelper";
export type { TokenRegistry } from "./src/TokenRegistry";
export type { ERC20 } from "./src/ERC20";

export { BridgeRouter__factory } from "./src/factories/BridgeRouter__factory";
export { BridgeToken__factory } from "./src/factories/BridgeToken__factory";
export { ETHHelper__factory } from "./src/factories/ETHHelper__factory";
export { TokenRegistry__factory } from "./src/factories/TokenRegistry__factory";
export { ERC20__factory } from "./src/factories/ERC20__factory";

const root = "packages/contracts-bridge/contracts";
export const BRIDGE_ROUTER_SPECIFIER = `${root}/BridgeRouter.sol:BridgeRouter`;
export const BRIDGE_TOKEN_SPECIFIER = `${root}/BridgeToken.sol:BridgeToken`;
export const ETH_HELPER_SPECIFIER = `${root}/ETHHelper.sol:ETHHelper`;
export const TOKEN_REGISTRY_SPECIFIER = `${root}/TokenRegistry.sol:TokenRegistry`;

export { version } from "./package.json";
