// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {Home} from "../../Home.sol";
import {Replica} from "../../Replica.sol";
import {XAppConnectionManager} from "../../XAppConnectionManager.sol";
import {UpdaterManager} from "../../UpdaterManager.sol";

import {UpgradeBeacon} from "../../upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconController} from "../../upgrade/UpgradeBeaconController.sol";
import {UpgradeBeaconProxy} from "../../upgrade/UpgradeBeaconProxy.sol";
import {GovernanceRouter} from "../../governance/GovernanceRouter.sol";

import {TypeCasts} from "../../libs/TypeCasts.sol";

import "./GoodXapps.sol";

abstract contract NomadCore is Test {
    /*//////////////////////////////////////////////////////////////
                                CONTRACTS
    //////////////////////////////////////////////////////////////*/

    GoodXappSimple xapp;
    Home homeImplementation;
    Replica replicaImplementation;
    GovernanceRouter governanceRouterImplementation;

    UpgradeBeaconProxy homeProxy;
    UpgradeBeaconProxy replicaProxy;
    UpgradeBeaconProxy governanceRouterProxy;

    Home home;
    Replica replica;
    GovernanceRouter governanceRouter;
    XAppConnectionManager xAppConnectionManager;
    UpdaterManager updaterManager;

    UpgradeBeacon homeBeacon;
    UpgradeBeacon replicaBeacon;
    UpgradeBeacon governanceRouterBeacon;

    UpgradeBeaconController controller;

    Home[] homes;
    mapping(uint32 => mapping(uint32 => Replica)) replicas;
    GovernanceRouter[] governanceRouters;
    XAppConnectionManager[] xAppConnectionManagers;
    UpdaterManager[] updaterManagers;

    UpgradeBeaconController[] controllers;

    UpgradeBeacon[] homeBeacons;
    mapping(uint256 => UpgradeBeacon) replicaBeacons;
    UpgradeBeacon[] governanceRouterBeacons;

    UpgradeBeaconProxy[] homeProxies;
    mapping(uint32 => mapping(uint32 => UpgradeBeaconProxy)) replicaProxies;
    UpgradeBeaconProxy[] governanceRouterProxies;

    Home[] homeImplementations;
    mapping(uint256 => Replica) replicaImplementations;
    GovernanceRouter[] governanceRouterImplementations;

    GoodXappSimple[] xapps;

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
    uint256 recoveryManagerKey;
    address recoveryManager;

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint32 localDomain;
    uint32 remoteDomain;
    bytes32 committedRoot;
    uint256 optimisticSeconds;
    uint256 recoveryTimelock;

    mapping(uint32 => uint256) domainToIndex;
    uint32[] domains;

    function setUp() public virtual {
        xapp = new GoodXappSimple();
        getEnv();
        domains.push(localDomain);
        domains.push(remoteDomain);
        setUpActors();
        printProtocolAttributes();
    }

    /// @notice Get user defined protocol attributes via env variables or set sane defaults
    function getEnv() public {
        try vm.envUint("NOMAD_CORE_HOME_DOMAIN") {
            localDomain = uint32(vm.envUint("NOMAD_CORE_HOME_DOMAIN"));
        } catch {
            localDomain = 1500;
        }
        try vm.envUint("NOMAD_CORE_REMOTE_DOMAIN") {
            remoteDomain = uint32(vm.envUint("NOMAD_CORE_REMOTE_DOMAIN"));
        } catch {
            remoteDomain = 3000;
        }
        try vm.envAddress("NOMAD_CORE_UPDATER") {
            updater = vm.envAddress("NOMAD_CORE_UPDATER");
        } catch {
            updaterKey = 2;
            updater = vm.addr(updaterKey);
        }
        try vm.envBytes32("NOMAD_CORE_COMMITTED_ROOT") {
            committedRoot = vm.envBytes32("NOMAD_CORE_COMMITTED_ROOT");
        } catch {
            committedRoot = "committedRoot";
        }
        try vm.envUint("NOMAD_CORE_OPTIMISTIC_SECONDS") {
            optimisticSeconds = vm.envUint("NOMAD_CORE_OPTIMISTIC_SECONDS");
        } catch {
            optimisticSeconds = 1800;
        }
        try vm.envUint("NOMAD_CORE_RECOVERY_TIMELOCK") {
            recoveryTimelock = vm.envUint("NOMAD_CORE_RECOVERY_TIMELOCK");
        } catch {
            recoveryTimelock = 180;
        }
    }

    function setUpActors() public {
        watcherKey = 1;
        watcher = vm.addr(watcherKey);
        relayerKey = 3;
        relayer = vm.addr(relayerKey);
        processorKey = 4;
        processor = vm.addr(processorKey);
        recoveryManagerKey = 5;
        recoveryManager = vm.addr(recoveryManagerKey);

        vm.label(updater, "Updater");
        vm.label(watcher, "Watcher");
        vm.label(processor, "Processor");
        vm.label(relayer, "Relayer");
        vm.label(recoveryManager, "Recovery Manager");
    }

    function printProtocolAttributes() public {
        console2.log("====SYSTEM ACTORS====");
        console2.log(" ");
        console2.log("Updater          Address:", updater);
        console2.log("Watcher          Address:", watcher);
        console2.log("Relayer          Address:", relayer);
        console2.log("Processor        Address:", processor);
        console2.log("Recovery Manager Address:", recoveryManager);
        console2.log(" ");
        console2.log("====DEFAULT ATTRIBUTES====");
        console2.log(" ");
        console2.log("localDomain:", localDomain);
        console2.log("remoteDomain:", remoteDomain);
        console2.log("optimisticSeconds:", optimisticSeconds);
        console2.log("recoveryTimelock:", recoveryTimelock);
    }

    function printDomainContracts(uint32 domain) public {
        uint256 index = domainToIndex[domain];
        console2.log("");
        console2.log("===CONTRACT ADDRESSES===");
        console2.log("");
        console2.log("DOMAIN:", domain);
        console2.log("");
        console2.log("homeBeacon", address(homeBeacons[index]));
        console2.log("homeController", address(controllers[index]));
        console2.log(
            "homeImplementations",
            address(homeImplementations[index])
        );
        console2.log("homeProxy", address(homeProxies[index]));
        // console2.log("");
        // console2.log("replicaBeacon", address(replicaBeacons[index]));
        // console2.log("replicaController", address(replicaControllers[index]));
        // console2.log(
        //     "replicaImplementation",
        //     address(replicaImplementations[index])
        // );
        // console2.log("replicaProxy", address(replicaProxies[index]));
        console2.log("");
        console2.log("updaterManager", address(updaterManagers[index]));
        console2.log("");
        console2.log(
            "xAppConnectionManager",
            address(xAppConnectionManagers[index])
        );
        console2.log("");
        console2.log(
            "governanceRouterImplementation",
            address(governanceRouterImplementations[index])
        );
        console2.log("governanceRouterController", address(controllers[index]));
        console2.log(
            "governanceRouterBeacon",
            address(governanceRouterBeacons[index])
        );
        console2.log(
            "governanceRouterProxy",
            address(governanceRouterProxies[index])
        );
    }

    function createCore(uint32 localDomain) public {
        bytes memory data;
        updaterManager = new UpdaterManager(updater);
        updaterManagers.push(updaterManager);
        assertEq(updaterManager.updater(), updater);

        controller = new UpgradeBeaconController();
        controllers.push(controller);

        homeImplementation = new Home(localDomain);
        homeBeacon = new UpgradeBeacon(
            address(homeImplementation),
            address(controller)
        );
        data = abi.encodeWithSignature(
            "initialize(address)",
            address(updaterManager)
        );
        homeProxy = new UpgradeBeaconProxy(address(homeBeacon), data);
        home = Home(address(homeProxy));

        updaterManager.setHome(address(home));

        homes.push(home);
        homeProxies.push(homeProxy);
        homeImplementations.push(homeImplementation);
        homeBeacons.push(homeBeacon);

        xAppConnectionManager = new XAppConnectionManager();
        xAppConnectionManager.setHome(address(home));
        xAppConnectionManagers.push(xAppConnectionManager);

        governanceRouterImplementation = new GovernanceRouter(
            localDomain,
            recoveryTimelock
        );
        governanceRouterBeacon = new UpgradeBeacon(
            address(governanceRouterImplementation),
            address(controller)
        );
        data = abi.encodeWithSignature(
            "initialize(address,address)",
            address(xAppConnectionManager),
            recoveryManager
        );
        governanceRouterProxy = new UpgradeBeaconProxy(
            address(governanceRouterBeacon),
            data
        );
        // Create a GovernaceRouter object so that we can call the Proxie's functions
        // as if we would call the contract itself.
        governanceRouter = GovernanceRouter(address(governanceRouterProxy));

        governanceRouters.push(governanceRouter);
        governanceRouterProxies.push(governanceRouterProxy);
        governanceRouterImplementations.push(governanceRouterImplementation);
        governanceRouterBeacons.push(governanceRouterBeacon);

        domainToIndex[localDomain] = homes.length - 1;
    }

    function createLocalReplicaForRemoteDomain(
        uint32 localDomain,
        uint32 remoteDomain
    ) public {
        bytes memory data;
        uint256 index = domainToIndex[localDomain];
        uint256 remoteIndex = domainToIndex[remoteDomain];

        replicaImplementation = new Replica(localDomain);
        replicaBeacon = new UpgradeBeacon(
            address(replicaImplementation),
            address(controllers[index])
        );
        data = abi.encodeWithSignature(
            "initialize(uint32,address,bytes32,uint256)",
            remoteDomain,
            updater,
            committedRoot,
            optimisticSeconds
        );
        replicaProxy = new UpgradeBeaconProxy(address(replicaBeacon), data);
        replica = Replica(address(replicaProxy));

        replicas[localDomain][remoteDomain] = replica;
        replicaProxies[localDomain][remoteDomain] = replicaProxy;
        replicaImplementations[localDomain] = replicaImplementation;
        replicaBeacons[localDomain] = replicaBeacon;
        xAppConnectionManagers[index].ownerEnrollReplica(
            address(replica),
            remoteDomain
        );
        xAppConnectionManagers[index].setWatcherPermission(
            address(watcher),
            remoteDomain,
            true
        );
        governanceRouters[index].setRouterLocal(
            remoteDomain,
            TypeCasts.addressToBytes32(address(governanceRouters[remoteIndex]))
        );
    }

    function relinquishCoreControl(uint32 localDomain) public {
        uint256 index = domainToIndex[localDomain];
        governanceRouter = governanceRouters[index];
        controllers[index].transferOwnership(address(governanceRouter));
        xAppConnectionManagers[index].transferOwnership(
            address(governanceRouter)
        );
        updaterManagers[index].transferOwnership(address(governanceRouter));
    }

    event TransferGovernor(
        uint32 previousGovernorDomain,
        uint32 newGovernorDomain,
        address indexed previousGovernor,
        address indexed newGovernor
    );

    function setGovernor(uint32 domain) public {
        uint256 index = domainToIndex[domain];
        address governor = address(governanceRouters[index]);
        vm.startPrank(governor);
        for (uint256 i; i < governanceRouters.length; i++) {
            address previousGovernor = governanceRouters[index].governor();
            uint32 previousGovernorDomain = governanceRouters[index]
                .governorDomain();
            vm.expectEmit(true, true, false, true);
            emit TransferGovernor(
                previousGovernorDomain,
                domain,
                previousGovernor,
                governor
            );
            governanceRouters[index].transferGovernor(domain, governor);
        }
        vm.stopPrank();
        console2.log("");
        console2.log("======");
        console2.log("Governor was transfered");
        console2.log("Domain: ", domain);
        console2.log("Address: ", governor);
        console2.log("======");
        console2.log("");
    }
}
