// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import "../../UpdaterManager.sol";
import "../../Home.sol";
import "../../Replica.sol";
import "../../XAppConnectionManager.sol";

import "../../upgrade/UpgradeBeacon.sol";
import "../../upgrade/UpgradeBeaconController.sol";
import "../../upgrade/UpgradeBeaconProxy.sol";

import "../../governance/GovernanceMessage.sol";
import "../../governance/GovernanceRouter.sol";

import "./GoodXapps.sol";

contract NomadCore is Test {
    /*//////////////////////////////////////////////////////////////
                                CONTRACTS
    //////////////////////////////////////////////////////////////*/

    GoodXappSimple xapp;
    UpdaterManager updaterManagerImplementation;
    Home homeImplementation;
    Replica replicaImplementation;
    XAppConnectionManager xAppConnectionManagerImplementation;

    UpgradeBeaconProxy home;
    UpgradeBeaconProxy replica;
    UpgradeBeaconProxy updaterManager;
    UpgradeBeaconProxy governanceRouter;
    UpgradeBeaconProxy xAppConnectionManager;

    UpgradeBeaconController homeController;
    UpgradeBeaconController replicaController;
    UpgradeBeaconController updaterManagerController;
    UpgradeBeaconController governanceRouterController;

    /*//////////////////////////////////////////////////////////////
                                 ACTORS
    //////////////////////////////////////////////////////////////*/

    uint256 watcherKey;
    address watcher;
    uint256 updaterKey;
    address updater;
    uint256 relayerKey;
    address relayer;
    uint256 processorKey;
    address processor;
    uint256[] usersKeys;
    address[] users;

    function setUp() {
        xapp = new GoodXappSimple();
    }

    function setUpActos() {
        watcherKey = 1;
        watcher = vm.addr(watcherKey);
        updaterKey = 2;
        updater = vm.addr(updaterKey);
        relayerKey = 3;
        relayer = vm.addr(relayerKey);
        relayerKey = 4;
        relayer = vm.addr(processorKey);

        vm.label(updater, "Updater");
        vm.label(fakeUpdater, "fake Updater");
        vm.label(watcher, "Watcher");
        vm.label(fakeWatcher, "fake Watcher");
        vm.label(processor, "Processor");
        vm.label(relayer, "Relayer");
    }

    function getEnv() {}

    function createCore() {}

    function createGov() {}

    function setUpdater() {}
}
