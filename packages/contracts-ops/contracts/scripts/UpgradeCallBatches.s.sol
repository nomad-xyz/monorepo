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

contract UpgradeCallBatchLogic is Script, Config, CallBatch {
    string currentDomain;

    function pushUpgrade(string memory _domain) internal {
        currentDomain = _domain;
        console2.log("upgrade ", _domain);
        pushSingleUpgrade(
            governanceRouterUpgrade(currentDomain),
            "governanceRouter"
        );
        pushSingleUpgrade(bridgeRouterUpgrade(currentDomain), "bridgeRouter");
        pushSingleUpgrade(bridgeTokenUpgrade(currentDomain), "bridgeToken");
        pushSingleUpgrade(tokenRegistryUpgrade(currentDomain), "tokenRegistry");
        pushSingleUpgrade(homeUpgrade(currentDomain), "home");
        pushSingleUpgrade(
            replicaOfUpgrade(currentDomain, getConnections(currentDomain)[0]),
            "replica"
        );
    }

    function pushSingleUpgrade(
        Upgrade memory _upgrade,
        string memory contractName
    ) private {
        // check if upgrade is unnecessary
        (, bytes memory result) = address(_upgrade.beacon).call("");
        address _current = abi.decode(result, (address));
        if (_current == _upgrade.implementation) {
            return;
        }
        console2.log("   upgrade ", contractName);
        // send upgrade
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

contract UpgradeCallBatches is UpgradeCallBatchLogic {
    // entrypoint
    function printCallBatches(
        string memory _configFile,
        string[] memory _domainNames,
        string memory _localDomainName,
        bool recovery
    ) external {
        localDomainName = _localDomainName;
        setUp(_configFile);
        for (uint256 i; i < _domainNames.length; i++) {
            pushUpgrade(_domainNames[i]);
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
}
