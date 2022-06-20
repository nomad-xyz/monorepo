/* tslint:disable */
/* eslint-disable */
export type { GovernanceRouter } from "./src/GovernanceRouter";
export type { Home } from "./src/Home";
export type { Replica } from "./src/Replica";
export type { UpdaterManager } from "./src/UpdaterManager";
export type { UpgradeBeacon } from "./src/UpgradeBeacon";
export type { UpgradeBeaconController } from "./src/UpgradeBeaconController";
export type { UpgradeBeaconProxy } from "./src/UpgradeBeaconProxy";
export type { XAppConnectionManager } from "./src/XAppConnectionManager";

export { GovernanceRouter__factory } from "./src/factories/GovernanceRouter__factory";
export { Home__factory } from "./src/factories/Home__factory";
export { Replica__factory } from "./src/factories/Replica__factory";
export { UpdaterManager__factory } from "./src/factories/UpdaterManager__factory";
export { UpgradeBeacon__factory } from "./src/factories/UpgradeBeacon__factory";
export { UpgradeBeaconController__factory } from "./src/factories/UpgradeBeaconController__factory";
export { UpgradeBeaconProxy__factory } from "./src/factories/UpgradeBeaconProxy__factory";
export { XAppConnectionManager__factory } from "./src/factories/XAppConnectionManager__factory";

export type { TypedEvent, TypedEventFilter, TypedListener } from "./src/common";

const root = "packages/contracts-core/contracts";
export const GOVERNANCE_ROUTER_SPECIFIER = `${root}/governance/GovernanceRouter.sol:GovernanceRouter`;
export const HOME_SPECIFIER = `${root}/Home.sol:Home`;
export const REPLICA_SPECIFIER = `${root}/Replica.sol:Replica`;
export const UPDATER_MANAGER_SPECIFIER = `${root}/UpdaterManager.sol:UpdaterManager`;
export const UPGRADE_BEACON_SPECIFIER = `${root}/upgrade/UpgradeBeacon.sol:UpgradeBeacon`;
export const UBP_SPECIFIER = `${root}/upgrade/UpgradeBeaconProxy.sol:UpgradeBeaconProxy`;
export const UBC_SPECIFIER = `${root}/upgrade/UpgradeBeaconController.sol:UpgradeBeaconController`;
export const XCM_SPECIFIER = `${root}/XAppConnectionManager.sol:XAppConnectionManager`;

export { version } from "./package.json";
