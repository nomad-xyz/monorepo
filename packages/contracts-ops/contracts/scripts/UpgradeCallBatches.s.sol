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
    string currentDomain;

    function printCallBatches(
        string memory _configFile,
        string[] memory _domainNames,
        string memory _localDomainName,
        bool recovery
    ) external {
        localDomainName = _localDomainName;
        setUp(_configFile);
        for (uint256 i; i < _domainNames.length; i++) {
            currentDomain = _domainNames[i];
            generateGovernanceCalls();
        }
        writeCallBatch(recovery);
    }

    function setUp(string memory _configFile) internal {
        __Config_initialize(_configFile);
        string memory _outputFile = "upgradeActions.json";
        __CallBatch_initialize(
            localDomainName,
            getDomainNumber(localDomainName),
            _outputFile,
            true
        );
        console2.log("Governance Actions have been output to", _outputFile);
    }

    /*//////////////////////////////////////////////////////////////
                       GOVERNANCE CALL GENERATORS
    //////////////////////////////////////////////////////////////*/

    function generateGovernanceCalls() internal {
        pushUpgrade(governanceRouterUpgrade(currentDomain));
        pushUpgrade(bridgeRouterUpgrade(currentDomain));
        pushUpgrade(bridgeTokenUpgrade(currentDomain));
        pushUpgrade(tokenRegistryUpgrade(currentDomain));
        pushUpgrade(homeUpgrade(currentDomain));
        pushUpgrade(
            replicaOfUpgrade(currentDomain, getConnections(currentDomain)[0])
        );
    }

    function pushUpgrade(Upgrade memory _upgrade) private {
        bytes memory call = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            address(_upgrade.beacon),
            address(_upgrade.implementation)
        );
        uint32 domainNumber = getDomainNumber(currentDomain);
        address beaconController = address(
            getUpgradeBeaconController(currentDomain)
        );
        if (domainNumber == getDomainNumber(localDomainName)) {
            pushLocal(beaconController, call);
        } else {
            pushRemote(beaconController, call, domainNumber);
        }
    }
}
