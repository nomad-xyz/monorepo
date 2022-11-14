// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
    //////////////////////////////////////////////////////////////*/

// Utilities
import {Script, console2} from "forge-std/Script.sol";

// Ops libs
import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

// Contract for selector
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";

contract UpgradeCallBatches is Script, Config, CallBatch {
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

    string configFile;
    string[] domainNames;
    string[] networksArray;

    function printCallBatches(
        string memory _configFile,
        string[] memory _domainNames,
        string memory _localDomainName,
        bool recovery
    ) external {
        localDomainName = _localDomainName;
        domainNames = _domainNames;
        configFile = _configFile;
        setUp();
        for (uint256 i; i < domainNames.length; i++) {
            string memory domain = domainNames[i];
            generateGovernanceCalls(domain);
        }
        writeCallBatch(recovery);
    }

    function setUp() internal {
        __Config_initialize(configFile);
        string memory outputFile = "upgradeActions.json";
        __CallBatch_initialize(
            localDomainName,
            getDomainNumber(localDomainName),
            outputFile,
            true
        );
        networksArray = getNetworks();
    }

    /*//////////////////////////////////////////////////////////////
                       GOVERNANCE CALL GENERATORS
    //////////////////////////////////////////////////////////////*/

    function generateGovernanceCalls(string memory domain) internal {
        title("BeaconController upgrade encoded calls for", domain);
        console2.log(
            "Domain Number: ",
            vm.toString(uint256(getDomainNumber(domain)))
        );
        console2.log("Function signature: upgrade(address, address)");
        console2.log(
            "Arguments: <contract_beacon>, <new_implementation_address>"
        );

        upgradeHome = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            homeBeacon,
            homeImpl
        );
        console2.log("Upgrade Home");
        console2.logBytes(upgradeHome);

        upgradeReplica = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            replicaBeacon,
            replicaImpl
        );
        console2.log("Upgrade Replica");
        console2.logBytes(upgradeReplica);
        upgradeGovRouter = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            governanceRouterBeacon,
            governanceRouterImpl
        );
        console2.log("Upgrade Governance Router");
        console2.logBytes(upgradeGovRouter);

        upgradeBridgeRouter = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            bridgeRouterBeacon,
            bridgeRouterImpl
        );
        console2.log("Upgrade Bridge Router");
        console2.logBytes(upgradeBridgeRouter);

        upgradeTokenRegistry = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            tokenRegistryBeacon,
            tokenRegistryImpl
        );
        console2.log("Upgrade Token Registry");
        console2.logBytes(upgradeTokenRegistry);

        upgradeBridgeToken = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            bridgeTokenBeacon,
            bridgeTokenImpl
        );
        console2.log("Upgrade Bridge Token");
        console2.logBytes(upgradeBridgeToken);
        uint32 domainNumber = getDomainNumber(domain);
        if (domainNumber == getDomainNumber(localDomainName)) {
            pushLocal(beaconController, upgradeBridgeToken);
            pushLocal(beaconController, upgradeTokenRegistry);
            pushLocal(beaconController, upgradeBridgeRouter);
            pushLocal(beaconController, upgradeGovRouter);
            pushLocal(beaconController, upgradeReplica);
            pushLocal(beaconController, upgradeHome);
        } else {
            pushRemote(beaconController, upgradeBridgeToken, domainNumber);
            pushRemote(beaconController, upgradeTokenRegistry, domainNumber);
            pushRemote(beaconController, upgradeBridgeRouter, domainNumber);
            pushRemote(beaconController, upgradeGovRouter, domainNumber);
            pushRemote(beaconController, upgradeReplica, domainNumber);
            pushRemote(beaconController, upgradeHome, domainNumber);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                UTILITIES
    //////////////////////////////////////////////////////////////*/

    function title(string memory title1) internal view {
        console2.log("===========================");
        console2.log(title1);
        console2.log("===========================");
    }

    function title(string memory title1, string memory title2) internal view {
        console2.log(" ");
        console2.log("===========================");
        console2.log(title1, title2);
        console2.log("===========================");
        console2.log(" ");
    }
}
