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

    // NOTE: these init values do not map to correct expected values.
    // Storage variables in implementation contracts don't matter.
    // Purpose is to initialize the implementations as a matter of best practice,
    // despite the fact that in Nomad's architecture,
    // un-initialized implementations can't harm the protocol
    // (unless, in the future, we introduce delegatecall in any implementations)
    function deployImplementations(string memory _domain) internal {
        // Home
        home = new Home(getDomainNumber(_domain));
        // NOTE: must pass real value for UpdaterManager because it is queried
        home.initialize(IUpdaterManager(address(getUpdaterManager(_domain))));
        // Replica
        replica = new Replica(getDomainNumber(_domain));
        replica.initialize(0, address(0), bytes32(0), 0);
        // GovernanceRouter
        governanceRouter = new GovernanceRouter(
            getDomainNumber(_domain),
            getRecoveryTimelock(_domain)
        );
        // NOTE: must pass real value for xAppConnectionManager because it is queried
        governanceRouter.initialize(
            address(getXAppConnectionManager(_domain)),
            address(0)
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
        BridgeRouter(bridgeRouter).initialize(address(0), address(0));
        // TokenRegistry
        tokenRegistry = new TokenRegistry();
        tokenRegistry.initialize(address(0), address(0));
        // BridgeToken
        bridgeToken = new BridgeToken();
        bridgeToken.initialize();
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
    ) external {
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
        vm.stopBroadcast();
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
        writeImplementation(buffer, inner, "home", address(home), false);
        writeImplementation(buffer, inner, "replica", address(replica), false);
        writeImplementation(
            buffer,
            inner,
            "governanceRouter",
            address(governanceRouter),
            false
        );
        writeImplementation(
            buffer,
            inner,
            "bridgeRouter",
            address(bridgeRouter),
            false
        );
        writeImplementation(
            buffer,
            inner,
            "tokenRegistry",
            address(tokenRegistry),
            false
        );
        writeImplementation(
            buffer,
            inner,
            "bridgeToken",
            address(bridgeToken),
            true
        );
        buffer.writeObjectClose(indent, true);
    }

    function writeImplementation(
        JsonWriter.Buffer memory buffer,
        string memory inner,
        string memory contractName,
        address implementation,
        bool terminal
    ) private {
        string[2][] memory kvs = new string[2][](1);
        kvs[0][0] = "implementation";
        kvs[0][1] = vm.toString(address(implementation));
        buffer.writeSimpleObject(
            inner.nextIndent(),
            contractName,
            kvs,
            terminal
        );
    }
}
