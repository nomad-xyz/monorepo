// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Script, console2} from "forge-std/Script.sol";
import {Config} from "../Config.sol";
import {DeployImplementationsLogic} from "./DeployImplementations.s.sol";

// Core
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
import {IUpdaterManager} from "@nomad-xyz/contracts-core/contracts/interfaces/IUpdaterManager.sol";
// Bridge
import {BridgeRouter, EthereumBridgeRouter} from "@nomad-xyz/contracts-bridge/contracts/BridgeRouter.sol";
import {BridgeToken} from "@nomad-xyz/contracts-bridge/contracts/BridgeToken.sol";
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";

contract InitializeImplementationsLogic is Script, Config {
    // NOTE: init values are zero wherever possible
    // Storage variables in implementation contracts don't matter.
    function initializeImplementations(string memory _domain) internal {
        console2.log("initialize implementations ", _domain);
        // Home
        // NOTE: must pass real value for UpdaterManager because it is queried
        Home home = getHomeImpl(_domain);
        if (address(home.updaterManager()) == address(0)) {
            console2.log("   initialize home ", _domain);
            home.initialize(
                IUpdaterManager(address(getUpdaterManager(_domain)))
            );
        }
        // Replica
        Replica replica = Replica(
            replicaOfUpgrade(_domain, getConnections(_domain)[0]).implementation
        );
        if (replica.owner() == address(0)) {
            console2.log("   initialize replica ", _domain);
            replica.initialize(0, address(0), bytes32(0), 0);
        }
        // GovernanceRouter
        // NOTE: must pass real value for xAppConnectionManager because it is queried
        GovernanceRouter governanceRouter = GovernanceRouter(
            governanceRouterUpgrade(_domain).implementation
        );
        if (address(governanceRouter.xAppConnectionManager()) == address(0)) {
            console2.log("   initialize governanceRouter ", _domain);

            governanceRouter.initialize(
                address(getXAppConnectionManager(_domain)),
                address(0)
            );
        }
        // BridgeRouter
        BridgeRouter bridgeRouter = BridgeRouter(
            payable(bridgeRouterUpgrade(_domain).implementation)
        );
        if (address(bridgeRouter.tokenRegistry()) == address(0)) {
            console2.log("   initialize bridgeRouter ", _domain);

            bridgeRouter.initialize(address(0), address(0));
        }
        // TokenRegistry
        TokenRegistry tokenRegistry = TokenRegistry(
            tokenRegistryUpgrade(_domain).implementation
        );
        if (tokenRegistry.owner() == address(0)) {
            console2.log("   initialize tokenRegistry ", _domain);

            tokenRegistry.initialize(address(0), address(0));
        }
        // BridgeToken
        BridgeToken bridgeToken = BridgeToken(
            bridgeTokenUpgrade(_domain).implementation
        );
        if (bridgeToken.owner() == address(0)) {
            console2.log("   initialize bridgeToken ", _domain);

            bridgeToken.initialize();
        }
    }
}

contract DeployAndInitializeImplementations is
    InitializeImplementationsLogic,
    DeployImplementationsLogic
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
        writeImplementationConfig(_domain);
        // initialize implementations
        initializeImplementations(_domain);
        vm.stopBroadcast();
    }
}
