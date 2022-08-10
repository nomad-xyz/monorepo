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
    GovernanceRouter governanceRouterImplementation;
    XAppConnectionManager xAppConnectionManagerImplementation;

    UpgradeBeaconProxy home;
    UpgradeBeaconProxy replica;
    UpgradeBeaconProxy updaterManager;
    UpgradeBeaconProxy governanceRouter;
    UpgradeBeaconProxy xAppConnectionManager;
    UpgradeBeaconProxy xAppConnectionManager;

    UpgradeBeacon homeBeacon;
    UpgradeBeacon replicaBeacon;
    UpgradeBeacon upgradeManagerBeacon;
    UpgradeBeacon governanceRouterBeacon;
    UpgradeBeacon xAppConnectionManagerBeacon;

    UpgradeBeaconController homeController;
    UpgradeBeaconController replicaController;
    UpgradeBeaconController updaterManagerController;
    UpgradeBeaconController governanceRouterController;
    UpgradeBeaconController xAppConnectionManagerController;

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

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint32 homeDomain;
    uint32 remoteDomain;

    function setUp() {
        xapp = new GoodXappSimple();
        setUpActors();
        createCore();
        enrollWatcherToGovRouter();
        setHome();
        relinquishControl();
        console2.log("Nomad Core is deployed!")
    }

    function setUpActors() {
        watcherKey = 1;
        watcher = vm.addr(watcherKey);
        updaterKey = 2;
        updater = vm.addr(updaterKey);
        relayerKey = 3;
        relayer = vm.addr(relayerKey);
        relayerKey = 4;
        relayer = vm.addr(processorKey);
        recoveryAdminKey = 5;
        recoveryAdmin = vm.addr(recoveryAdminKey);

        vm.label(updater, "Updater");
        vm.label(fakeUpdater, "fake Updater");
        vm.label(watcher, "Watcher");
        vm.label(fakeWatcher, "fake Watcher");
        vm.label(processor, "Processor");
        vm.label(relayer, "Relayer");
        vm.label(recoveryAdmin, "Recovery Admin");

        console2.log("Updater   Address:", updater);
        console2.log("Watcher   Address:", watcher);
        console2.log("Relayer   Address:", relayer);
        console2.log("Processor Address:", processor);
        console2.log("Recovery Admin Address:", recoveryAdmin);
    }

    function createCore(
        uint32 homeDomain,
        uint32 remoteDomain,
        address updater,
        bytes32 committedRoot,
        uint256 optimisticSeconds,
        uint256 recoveryTimeLock
    ) {
        xAppConnectionManagerImplementation = new XAppConnectionManager();
        xAppConnectionManagerController = new UpgradeBeaconController();
        xAppConnectionManagerBeacon = new UpgradeBeacon(
            address(xAppConnectionManagerImplementation),
            address(xAppConnectionManagerController)
        );
        bytes memory data = abi.encode(hex"");

        xAppConnectionManager = new UpgradeBeaconProxy(
            address(xAppConnectionManagerBeacon),
            data
        );

        governanceRouterImplementation = new governaceRouter(
            homeDomain,
            recoveryTimeLock
        );
        governanceRouterController = new UpgradeBeaconController();
        governanceRouterBeacon = new UpgradeBeacon(
            address(governanceRouterImplementation),
            address(governanceRouterController)
        );
        bytes memory data = abi.encode(
            address(xAppConnectionManager),
            recoveryManager
        );
        governanceRouter = new UpgradeBeaconProxy(
            address(governanceRouterBeacon),
            data
        );

        homeImplementation = new Home(uint32(0));
        homeController = new UpgradeBeaconController();
        homeBeacon = new UpgradeBeacon(
            address(homeImplementation),
            address(homeController)
        );
        bytes memory data = abi.encode(homeDomain);
        home = new UpgradeBeaconProxy(address(homeBeacon), data);

        replicaImplementation = new Replica(uint32(0));
        replicaController = new UpgradeBeaconController();
        replicaBeacon = new UpgradeBeacon(
            address(replicaImplementation),
            address(replicaController)
        );
        bytes memory data = abi.encode(
            remoteDomain,
            updater,
            committedRoot,
            optimisticSeconds
        );
        replica = new UpgradeBeaconProxy(address(replicaBeacon), data);

        updaterManagerImplementation = new updaterManager(uint32(0));
        updaterManagerController = new UpgradeBeaconController();
        updaterManagerBeacon = new UpgradeBeacon(
            address(updaterManagerImplementation),
            address(updaterManagerController)
        );
        bytes memory data = abi.encode(hex"");
        updaterManager = new UpgradeBeaconProxy(
            address(updaterManagerBeacon),
            data
        );
    }

    function enrollWatcherToGovRouter() {
        xAppConnectionManager.ownerEnrollReplica(
            address(replica),
            remoteDomain
        );
    }

    function setHome() {
        updaterManager.setHome(address(home));
        xAppConnectionManager.setHome(homeDomain);
    }

    function relinquishControl() {
        governanceRouter.transferOwnership(address(governanceRouter));
        xAppConnectionManager.transferOwnership(address(governanceRouter));
        replicaController.transferOwnership(address(governanceRouter));
        homeController.transferOwnership(address(governanceRouter));
        updaterManager.transferOwnership(address(governanceRouter));
    }
}
