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
        // GovernanceRouter
        governanceRouter = new GovernanceRouter(
            getDomainNumber(_domain),
            getRecoveryTimelock(_domain)
        );
        // Home
        home = new Home(getDomainNumber(_domain));
        // Replica
        replica = new Replica(getDomainNumber(_domain));
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
        // BridgeToken
        bridgeToken = new BridgeToken();
        // TokenRegistry
        tokenRegistry = new TokenRegistry();
    }
}

contract DeployImplementations is DeployImplementationsLogic {
    using JsonWriter for JsonWriter.Buffer;
    using JsonWriter for string;

    JsonWriter.File outputFile;

    // entrypoint
    function deploy(
        string memory _configPath,
        string memory _outputFile,
        string memory _domain
    ) public {
        __Config_initialize(_configPath);
        // begin output file
        _outputFile = string(abi.encodePacked("./actions/", _outputFile));
        outputFile.path = _outputFile;
        outputFile.overwrite = false;
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        string memory indent = "";
        buffer.writeObjectOpen(indent);
        // loop through domains and deploy implementations
        vm.createSelectFork(getRpcs(_domain)[0]);
        vm.startBroadcast();
        deployImplementations(_domain);
        write(buffer, indent.nextIndent(), _domain);
        // write final output
        buffer.writeObjectClose(indent, true);
        buffer.flushTo(outputFile);
    }

    function write(
        JsonWriter.Buffer memory buffer,
        string memory indent,
        string memory _domain
    ) private {
        // start
        buffer.writeObjectOpen(indent, _domain);
        string memory inner = indent.nextIndent();
        // write implementations
        writeImplementation(
            buffer,
            inner,
            "governanceRouter",
            governanceRouterUpgrade(_domain),
            address(governanceRouter),
            false
        );
        writeImplementation(
            buffer,
            inner,
            "home",
            homeUpgrade(_domain),
            address(home),
            false
        );
        writeImplementation(
            buffer,
            inner,
            "replica",
            replicaOfUpgrade(_domain, getConnections(_domain)[0]),
            address(replica),
            false
        );
        writeImplementation(
            buffer,
            inner,
            "bridgeRouter",
            bridgeRouterUpgrade(_domain),
            address(bridgeRouter),
            false
        );
        writeImplementation(
            buffer,
            inner,
            "bridgeToken",
            bridgeTokenUpgrade(_domain),
            address(bridgeToken),
            true
        );
        writeImplementation(
            buffer,
            inner,
            "tokenRegistry",
            tokenRegistryUpgrade(_domain),
            address(tokenRegistry),
            false
        );
        buffer.writeObjectClose(indent, true);
    }

    function writeImplementation(
        JsonWriter.Buffer memory buffer,
        string memory inner,
        string memory contractName,
        Upgrade memory _upgrade,
        address newImplementation,
        bool terminal
    ) private {
        string[2][] memory kvs = new string[2][](3);
        kvs[0][0] = "beacon";
        kvs[0][1] = vm.toString(address(_upgrade.beacon));
        kvs[1][0] = "implementation";
        kvs[1][1] = vm.toString(address(newImplementation));
        kvs[2][0] = "proxy";
        kvs[2][1] = vm.toString(address(_upgrade.proxy));
        buffer.writeSimpleObject(
            inner.nextIndent(),
            contractName,
            kvs,
            terminal
        );
    }
}
