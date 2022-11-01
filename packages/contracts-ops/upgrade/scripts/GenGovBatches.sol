// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
    //////////////////////////////////////////////////////////////*/

// Contracts to be upgraded
import {Home} from "../../contracts-core/contracts/Home.sol";
import {Replica} from "../../contracts-core/contracts/Replica.sol";
import {XAppConnectionManager} from "../../contracts-core/contracts/XAppConnectionManager.sol";
import {GovernanceRouter} from "../../contracts-core/contracts/governance/GovernanceRouter.sol";
import {BridgeRouter} from "../../contracts-bridge/contracts/BridgeRouter.sol";
import {BridgeToken} from "../../contracts-bridge/contracts/BridgeToken.sol";
import {TokenRegistry} from "../../contracts-bridge/contracts/TokenRegistry.sol";

// Utilities
import {Test} from "forge-std/Test.sol";

// Ops libs
import {Config} from "../../contracts/Config.sol";
import {CallBatch} from "../../contracts/Callbatch.sol";

contract GenGovBatches is Test, Config, CallBatch {
    string domainName;

    /*//////////////////////////////////////////////////////////////
                                 BEACONS
    //////////////////////////////////////////////////////////////*/

    address homeBeacon;
    address replicaBeacon;
    address governanceRouterBeacon;
    address bridgeRouterBeacon;
    address tokenRegistryBeacon;
    address bridgeTokenBeacon;

    /*//////////////////////////////////////////////////////////////
                             IMPLEMENTATIONS
    //////////////////////////////////////////////////////////////*/

    address homeImpl;
    address replicaImpl;
    address governanceRouterImpl;
    address bridgeTokenImpl;
    address tokenRegistryImpl;
    address bridgeRouterImpl;

    /*//////////////////////////////////////////////////////////////
                            GOVERNANCE CALLS
    //////////////////////////////////////////////////////////////*/

    bytes upgradeHome;
    bytes upgradeReplica;
    bytes upgradeGovRouter;
    bytes upgradeBridgeRouter;
    bytes upgradeTokenRegistry;
    bytes upgradeBridgeToken;

    address beaconController;

    bytes executeCallBatchCall;

    bool buildIt;

    function run(
        string calldata configFile,
        string calldata localDomain,
        string calldata output,
        bool buildIt
    ) external {
        __Config_initialize(configFile);
        __CallBatch_initialize(localDomain, output);
    }

    function loadBeacons() internal {
        bridgeTokenBeacon = bridgeToken(localDomain).implementation;
        tokenRegistryBeacon = tokenRegistry(localDomain).implementation;
        bridgeRouterBeacon = bridgeRouter(localDomain).implementation;
        governanceRouterBeacon = governanceRouter(localDomain).implementation;
        replicaBeacon = replica(localDomain).implementation;
        homeBeacon = home(localDomain).implementation;
    }

    function loadImplementations() internal {
        bridgeTokenImpl = bridgeToken(localDomain).implementation;
        tokenRegistryImpl = tokenRegistry(localDomain).implementation;
        bridgeRouterImpl = bridgeRouter(localDomain).implementation;
        governanceRouterImpl = governanceRouter(localDomain).implementation;
        replicaImpl = replica(localDomain).implementation;
        homeImpl = home(localDomain).implementation;
    }

    function loadController() internal {
        beaconController = home(localDomain).controller;
    }

    /*//////////////////////////////////////////////////////////////
                       GOVERNANCE CALL GENERATORS
    //////////////////////////////////////////////////////////////*/

    function generateGovernanceCalls() internal {
        title("BeaconController upgrade encoded calls");
        console2.log("Function signature: upgrade(address, address)");
        console2.log(
            "Arguments: <contract_beacon>, <new_implementation_address>"
        );

        upgradeHome = abi.encodeWithSignature(
            "upgrade(address, address)",
            homeBeacon,
            address(newHome)
        );
        console2.log("Upgrade Home");
        console2.logBytes(upgradeHome);
        push(controller, upgradeHome);

        upgradeReplica = abi.encodeWithSignature(
            "upgrade(address, address)",
            replicaBeacon,
            address(newReplica)
        );
        console2.log("Upgrade Replica");
        console2.logBytes(upgradeReplica);
        push(controller, upgradeReplica);

        upgradeGovRouter = abi.encodeWithSignature(
            "upgrade(address, address)",
            governanceRouterBeacon,
            address(newGovernanceRouter)
        );
        console2.log("Upgrade Governance Router");
        console2.logBytes(upgradeGovRouter);
        push(controller, upgradeGovRouter);

        upgradeBridgeRouter = abi.encodeWithSignature(
            "upgrade(address, address)",
            bridgeRouterBeacon,
            address(newBridgeRouter)
        );
        console2.log("Upgrade Bridge Router");
        console2.logBytes(upgradeBridgeRouter);
        push(controller, upgradeBridgeRouter);

        upgradeTokenRegistry = abi.encodeWithSignature(
            "upgrade(address, address)",
            tokenRegistryBeacon,
            address(newTokenRegistry)
        );
        console2.log("Upgrade Token Registry");
        console2.logBytes(upgradeTokenRegistry);
        push(controller, upgradeTokenRegistry);

        upgradeBridgeToken = abi.encodeWithSignature(
            "upgrade(address, address)",
            bridgeTokenBeacon,
            address(newBridgeToken)
        );
        console2.log("Upgrade Bridge Token");
        console2.logBytes(upgradeBridgeToken);
        push(controller, upgradeBridgeToken);

        buildIt ? build(governanceRouter) : finish;
    }

    /*//////////////////////////////////////////////////////////////
                                UTILITIES
    //////////////////////////////////////////////////////////////*/

    function title(string memory title1) internal {
        console2.log("===========================");
        console2.log(title1);
        console2.log("===========================");
    }

    function title(string memory title1, string memory title2) internal {
        console2.log(" ");
        console2.log("===========================");
        console2.log(title1, title2);
        console2.log("===========================");
        console2.log(" ");
    }
}
