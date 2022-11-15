// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {DeployImplementationsLogic} from "./DeployImplementations.s.sol";
import {IUpdaterManager} from "@nomad-xyz/contracts-core/contracts/interfaces/IUpdaterManager.sol";

contract DeployAndInitializeImplementationsLogic is DeployImplementationsLogic {
    // NOTE: init values are zero wherever possible
    // Storage variables in implementation contracts don't matter.
    function initializeImplementations(string memory _domain) internal {
        // Home
        // NOTE: must pass real value for UpdaterManager because it is queried
        home.initialize(IUpdaterManager(address(getUpdaterManager(_domain))));
        // Replica
        replica.initialize(0, address(0), bytes32(0), 0);
        // GovernanceRouter
        // NOTE: must pass real value for xAppConnectionManager because it is queried
        governanceRouter.initialize(
            address(getXAppConnectionManager(_domain)),
            address(0)
        );
        // BridgeRouter
        bridgeRouter.initialize(address(0), address(0));
        // TokenRegistry
        tokenRegistry.initialize(address(0), address(0));
        // BridgeToken
        bridgeToken.initialize();
    }
}

contract DeployAndInitializeImplementations is
    DeployAndInitializeImplementationsLogic
{
    // entrypoint
    function deployAndInitialize(
        string memory _configPath,
        string memory _domain
    ) public {
        __Config_initialize(_configPath);
        vm.createSelectFork(getRpcs(_domain)[0]);
        vm.startBroadcast();
        // deploy implementations
        deployImplementations(_domain);
        // initialize implementations
        initializeImplementations(_domain);
        vm.stopBroadcast();
    }
}
