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
    function printCallBatches(
        string memory _configFile,
        string[] memory _domainNames,
        string memory _localDomainName,
        bool recovery
    ) external {
        localDomainName = _localDomainName;
        setUp(_configFile);
        for (uint256 i; i < _domainNames.length; i++) {
            string memory domain = _domainNames[i];
            generateGovernanceCalls(domain);
        }
        writeCallBatch(recovery);
    }

    function setUp(string memory _configFile) internal {
        __Config_initialize(_configFile);
        string memory outputFile = "upgradeActions.json";
        __CallBatch_initialize(
            localDomainName,
            getDomainNumber(localDomainName),
            outputFile,
            true
        );
        console2.log("Governance Actions have been output to", outputFile);
    }

    /*//////////////////////////////////////////////////////////////
                       GOVERNANCE CALL GENERATORS
    //////////////////////////////////////////////////////////////*/

    function generateGovernanceCalls(string memory domain) internal {
        bytes memory upgradeHome;
        bytes memory upgradeReplica;
        bytes memory upgradeGovRouter;
        bytes memory upgradeBridgeRouter;
        bytes memory upgradeTokenRegistry;
        bytes memory upgradeBridgeToken;

        upgradeHome = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            address(homeUpgrade(domain).beacon),
            address(homeUpgrade(domain).implementation)
        );
        string[] memory networks = getNetworks();
        address replicaImpl;
        address replicaBeacon;
        for (uint256 i; i < networks.length; i++) {
            if (getDomainNumber(networks[i]) != getDomainNumber(domain)) {
                replicaImpl = address(
                    replicaOfUpgrade(domain, networks[i]).implementation
                );
                replicaBeacon = address(
                    replicaOfUpgrade(domain, networks[i]).beacon
                );
            }
        }
        upgradeReplica = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            replicaBeacon,
            replicaImpl
        );
        upgradeGovRouter = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            address(governanceRouterUpgrade(domain).beacon),
            address(governanceRouterUpgrade(domain).implementation)
        );
        upgradeBridgeRouter = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            address(bridgeRouterUpgrade(domain).beacon),
            address(bridgeRouterUpgrade(domain).implementation)
        );
        upgradeTokenRegistry = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            address(tokenRegistryUpgrade(domain).beacon),
            address(tokenRegistryUpgrade(domain).implementation)
        );
        upgradeBridgeToken = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            address(bridgeTokenUpgrade(domain).beacon),
            address(bridgeTokenUpgrade(domain).implementation)
        );
        uint32 domainNumber = getDomainNumber(domain);
        address beaconController = address(getUpgradeBeaconController(domain));
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
}
