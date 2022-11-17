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

    Home homeImpl;
    Replica replicaImpl;
    GovernanceRouter governanceRouterImpl;
    BridgeRouter bridgeRouterImpl;
    TokenRegistry tokenRegistryImpl;
    BridgeToken bridgeTokenImpl;

    /*//////////////////////////////////////////////////////////////
                       IMPLEMENTATION DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    function deployImplementations(string memory _domain) internal {
        // Home
        homeImpl = new Home(getDomainNumber(_domain));
        // Replica
        replicaImpl = new Replica(getDomainNumber(_domain));
        // GovernanceRouter
        governanceRouterImpl = new GovernanceRouter(
            getDomainNumber(_domain),
            getRecoveryTimelock(_domain)
        );
        // BridgeRouter
        if (keccak256(bytes(_domain)) == keccak256(bytes("ethereum"))) {
            bridgeRouterImpl = BridgeRouter(
                address(
                    new EthereumBridgeRouter(address(getAccountant(_domain)))
                )
            );
        } else {
            bridgeRouterImpl = new BridgeRouter();
        }
        // TokenRegistry
        tokenRegistryImpl = new TokenRegistry();
        // BridgeToken
        bridgeTokenImpl = new BridgeToken();
    }

    function writeImplementationConfig(string memory _domain) internal {
        vm.writeJson(
            vm.toString(address(homeImpl)),
            outputPath,
            coreAttributePath(_domain, "home.implementation")
        );
        vm.writeJson(
            vm.toString(address(governanceRouterImpl)),
            outputPath,
            coreAttributePath(_domain, "governanceRouter.implementation")
        );
        string[] memory connections = getConnections(_domain);
        for (uint256 i; i < connections.length; i++) {
            vm.writeJson(
                vm.toString(address(replicaImpl)),
                outputPath,
                string(
                    abi.encodePacked(
                        replicaOfPath(_domain, connections[i]),
                        ".implementation"
                    )
                )
            );
        }
        vm.writeJson(
            vm.toString(address(bridgeRouterImpl)),
            outputPath,
            bridgeAttributePath(_domain, "bridgeRouter.implementation")
        );
        vm.writeJson(
            vm.toString(address(bridgeTokenImpl)),
            outputPath,
            bridgeAttributePath(_domain, "bridgeToken.implementation")
        );
        vm.writeJson(
            vm.toString(address(tokenRegistryImpl)),
            outputPath,
            bridgeAttributePath(_domain, "tokenRegistry.implementation")
        );
        reloadConfig();
    }
}

contract DeployImplementations is DeployImplementationsLogic {
    // entrypoint
    function deploy(string memory _configName, string memory _domain) public {
        __Config_initialize(_configName);
        vm.createSelectFork(getRpcs(_domain)[0]);
        vm.startBroadcast();
        deployImplementations(_domain);
        vm.stopBroadcast();
        writeImplementationConfig(_domain);
    }
}
