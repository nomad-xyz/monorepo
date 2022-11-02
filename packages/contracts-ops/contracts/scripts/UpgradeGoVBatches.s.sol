// SPDX-License-Identifier: MIT OR Apachpe-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
    //////////////////////////////////////////////////////////////*/

// Utilities
import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";

// Ops libs
import {Config} from "../Config.sol";
import {CallBatch} from "../Callbatch.sol";

contract UpgradeGovBatches is Test, Config, CallBatch {
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
    address governanceRouterProxy;

    bytes executeCallBatchCall;

    string localDomain;
    string[] networksArray;

    function run(
        string calldata configFile,
        string calldata _localDomain,
        bool buildIt
    ) external {
        string memory filename = string(
            abi.encodePacked("upgradeGovBatches-", _localDomain, ".json")
        );
        __Config_initialize(configFile);
        __CallBatch_initialize(_localDomain, filename);
        localDomain = _localDomain;
        networksArray = networks();
        loadBeacons();
        loadImplementations();
        loadController();
        generateGovernanceCalls();
        console2.log(
            string(
                abi.encodePacked("Batch will be output to 'actions/'", filename)
            )
        );
        buildIt ? build(address(governanceRouterProxy)) : finish();
    }

    function loadBeacons() internal {
        bridgeTokenBeacon = address(bridgeTokenUpgrade(localDomain).beacon);
        tokenRegistryBeacon = address(tokenRegistryUpgrade(localDomain).beacon);
        bridgeRouterBeacon = address(bridgeRouterUpgrade(localDomain).beacon);
        governanceRouterBeacon = address(
            governanceRouterUpgrade(localDomain).beacon
        );
        governanceRouterProxy = address(
            governanceRouterUpgrade(localDomain).proxy
        );
        for (uint256 i; i < networksArray.length; i++) {
            if (
                keccak256(abi.encodePacked(networksArray[i])) !=
                keccak256(abi.encodePacked(localDomain))
            ) {
                replicaBeacon = address(
                    replicaOfUpgrade(localDomain, networksArray[i]).beacon
                );
                break;
            }
            homeImpl = address(homeUpgrade(localDomain).beacon);
        }
        homeBeacon = address(homeUpgrade(localDomain).beacon);
    }

    function loadImplementations() internal {
        bridgeTokenImpl = bridgeTokenUpgrade(localDomain).implementation;
        tokenRegistryImpl = tokenRegistryUpgrade(localDomain).implementation;
        bridgeRouterImpl = bridgeRouterUpgrade(localDomain).implementation;
        governanceRouterImpl = governanceRouterUpgrade(localDomain)
            .implementation;
        // All replicas have the same implmentation
        for (uint256 i; i < networksArray.length; i++) {
            if (
                keccak256(abi.encodePacked(networksArray[i])) !=
                keccak256(abi.encodePacked(localDomain))
            ) {
                replicaImpl = replicaOfUpgrade(localDomain, networksArray[i])
                    .implementation;
                break;
            }
            homeImpl = homeUpgrade(localDomain).implementation;
        }
    }

    function loadController() internal {
        beaconController = address(upgradeBeaconController(localDomain));
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
            homeImpl
        );
        console2.log("Upgrade Home");
        console2.logBytes(upgradeHome);
        push(beaconController, upgradeHome);

        upgradeReplica = abi.encodeWithSignature(
            "upgrade(address, address)",
            replicaBeacon,
            replicaImpl
        );
        console2.log("Upgrade Replica");
        console2.logBytes(upgradeReplica);
        push(beaconController, upgradeReplica);

        upgradeGovRouter = abi.encodeWithSignature(
            "upgrade(address, address)",
            governanceRouterBeacon,
            governanceRouterImpl
        );
        console2.log("Upgrade Governance Router");
        console2.logBytes(upgradeGovRouter);
        push(beaconController, upgradeGovRouter);

        upgradeBridgeRouter = abi.encodeWithSignature(
            "upgrade(address, address)",
            bridgeRouterBeacon,
            bridgeRouterImpl
        );
        console2.log("Upgrade Bridge Router");
        console2.logBytes(upgradeBridgeRouter);
        push(beaconController, upgradeBridgeRouter);

        upgradeTokenRegistry = abi.encodeWithSignature(
            "upgrade(address, address)",
            tokenRegistryBeacon,
            tokenRegistryImpl
        );
        console2.log("Upgrade Token Registry");
        console2.logBytes(upgradeTokenRegistry);
        push(beaconController, upgradeTokenRegistry);

        upgradeBridgeToken = abi.encodeWithSignature(
            "upgrade(address, address)",
            bridgeTokenBeacon,
            bridgeTokenImpl
        );
        console2.log("Upgrade Bridge Token");
        console2.logBytes(upgradeBridgeToken);
        push(beaconController, upgradeBridgeToken);
    }

    /*//////////////////////////////////////////////////////////////
                                UTILITIES
    //////////////////////////////////////////////////////////////*/

    function title(string memory title1) internal view {
        console2.log("===========================");
        console2.log(title1);
        console2.log("===========================");
    }

    function title(string memory title1, string memory title2)
        internal
        view
        kkkkkkk
    {
        console2.log(" ");
        console2.log("===========================");
        console2.log(title1, title2);
        console2.log("===========================");
        console2.log(" ");
    }
}
