// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
//////////////////////////////////////////////////////////////*/
// Core
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
import {IUpdaterManager} from "@nomad-xyz/contracts-core/contracts/interfaces/IUpdaterManager.sol";
// Bridge
import {BridgeRouter, EthereumBridgeRouter} from "@nomad-xyz/contracts-bridge/contracts/BridgeRouter.sol";
import {BridgeToken} from "@nomad-xyz/contracts-bridge/contracts/BridgeToken.sol";
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";
// Ops
import {Config} from "../Config.sol";
import {JsonWriter} from "../JsonWriter.sol";
// Utilities
import {Script} from "forge-std/Script.sol";

abstract contract DeployImplementationsLogic is Script, Config {
    /*//////////////////////////////////////////////////////////////
                          DEPLOYED CONTRACTS
    //////////////////////////////////////////////////////////////*/

    Home home;
    Replica replica;
    GovernanceRouter governanceRouter;
    BridgeRouter bridgeRouter;
    TokenRegistry tokenRegistry;
    BridgeToken bridgeToken;

    /*//////////////////////////////////////////////////////////////
                       IMPLEMENTATION DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    function deployImplementations(string memory _domain) internal {
        // Home
        home = new Home(getDomainNumber(_domain));
        // Replica
        replica = new Replica(getDomainNumber(_domain));
        // GovernanceRouter
        governanceRouter = new GovernanceRouter(
            getDomainNumber(_domain),
            getRecoveryTimelock(_domain)
        );
        // BridgeRouter
        if (keccak256(bytes(_domain)) == keccak256(bytes("ethereum"))) {
            bridgeRouter = BridgeRouter(
                address(
                    new EthereumBridgeRouter(address(getAccountant(_domain)))
                )
            );
        } else {
            bridgeRouter = new BridgeRouter();
        }
        // TokenRegistry
        tokenRegistry = new TokenRegistry();
        // BridgeToken
        bridgeToken = new BridgeToken();
    }

    function writeImplementationConfig(string memory _domain) internal {
        vm.writeJson(
            vm.toString(address(home)),
            configPath,
            coreAttributePath(_domain, "home.implementation")
        );
        vm.writeJson(
            vm.toString(address(governanceRouter)),
            configPath,
            coreAttributePath(_domain, "governanceRouter.implementation")
        );
        string[] memory connections = getConnections(_domain);
        for (uint256 i; i < connections.length; i++) {
            vm.writeJson(
                vm.toString(address(replica)),
                configPath,
                string(
                    abi.encodePacked(
                        replicaOfPath(_domain, connections[i]),
                        ".implementation"
                    )
                )
            );
        }
        vm.writeJson(
            vm.toString(address(bridgeRouter)),
            configPath,
            bridgeAttributePath(_domain, "bridgeRouter.implementation")
        );
        vm.writeJson(
            vm.toString(address(bridgeToken)),
            configPath,
            bridgeAttributePath(_domain, "bridgeToken.implementation")
        );
        vm.writeJson(
            vm.toString(address(tokenRegistry)),
            configPath,
            bridgeAttributePath(_domain, "tokenRegistry.implementation")
        );
        reloadConfig();
    }
}

contract DeployImplementations is DeployImplementationsLogic {
    // entrypoint
    function deploy(string memory _configPath, string memory _domain) public {
        __Config_initialize(_configPath);
        vm.createSelectFork(getRpcs(_domain)[0]);
        vm.startBroadcast();
        deployImplementations(_domain);
        vm.stopBroadcast();
        writeImplementationConfig(_domain);
    }
}
