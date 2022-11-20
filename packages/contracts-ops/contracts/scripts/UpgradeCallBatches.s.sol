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
    function pushUpgrade(string memory _domain) internal {
        pushSingleUpgrade(governanceRouterUpgrade(_domain), _domain);
        pushSingleUpgrade(bridgeRouterUpgrade(_domain), _domain);
        pushSingleUpgrade(bridgeTokenUpgrade(_domain), _domain);
        pushSingleUpgrade(tokenRegistryUpgrade(_domain), _domain);
        pushSingleUpgrade(homeUpgrade(_domain), _domain);
        pushSingleUpgrade(
            replicaOfUpgrade(_domain, getConnections(_domain)[0]),
            _domain
        );
    }

    function pushSingleUpgrade(Upgrade memory _upgrade, string memory _domain)
        internal
    {
        // check if upgrade is unnecessary
        (, bytes memory result) = address(_upgrade.beacon).staticcall("");
        address _current = abi.decode(result, (address));
        if (_current == _upgrade.implementation) {
            return;
        }
        // send upgrade
        bytes memory call = abi.encodeWithSelector(
            UpgradeBeaconController.upgrade.selector,
            address(_upgrade.beacon),
            address(_upgrade.implementation)
        );
        uint32 domainNumber = getDomainNumber(_domain);
        address beaconController = address(getUpgradeBeaconController(_domain));
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
        string memory _configName,
        string[] memory _domainNames,
        string memory _localDomainName,
        bool recovery
    ) external {
        localDomainName = _localDomainName;
        setUp(_configName);
        for (uint256 i; i < _domainNames.length; i++) {
            pushUpgrade(_domainNames[i]);
        }
        writeCallBatch(recovery);
    }

    function setUp(string memory _configName) internal {
        __Config_initialize(_configName);
        string memory _batchOutput = "upgradeActions";
        __CallBatch_initialize(
            localDomainName,
            getDomainNumber(localDomainName),
            _batchOutput,
            true
        );
        console2.log("Governance Actions have been output to", _batchOutput);
    }
}
