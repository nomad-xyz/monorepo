// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

// solhint-disable quotes

import {GovernanceMessage} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceMessage.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import {JsonWriter} from "./JsonWriter.sol";

import "forge-std/Script.sol";
import "forge-std/console2.sol";

abstract contract CallBatch is Script {
    using JsonWriter for JsonWriter.Buffer;
    using JsonWriter for string;

    GovernanceMessage.Call[] public localCalls;
    GovernanceMessage.Call[][] public remoteCalls;
    mapping(string => GovernanceMessage.Call[]) public remoteCallsMap;

    bool public complete;
    string public localDomain;
    string[] public remoteDomains;
    JsonWriter.File outputFile;

    function __CallBatch_initialize(
        string memory _localDomain,
        string memory _outputFile,
        bool _overwrite
    ) public {
        __CallBatch_initialize(
            _localDomain,
            new string[](0),
            _outputFile,
            _overwrite
        );
    }

    function __CallBatch_initialize(
        string memory _localDomain,
        string[] memory _remoteDomains,
        string memory _outputFilePath,
        bool _overwrite
    ) public {
        require(bytes(localDomain).length == 0, "already initialized");
        require(bytes(outputFile.path).length == 0, "already initialized");
        outputFile.path = _outputFilePath;
        outputFile.overwrite = _overwrite;
        localDomain = _localDomain;
        remoteDomains = _remoteDomains;
        outputFile.path = string(
            abi.encodePacked("./actions/", _outputFilePath)
        );
    }

    function pushRemote(
        address to,
        bytes memory data,
        string memory domain
    ) public {
        remoteCallsMap[domain].push(
            GovernanceMessage.Call(TypeCasts.addressToBytes32(to), data)
        );
    }

    function pushLocal(address to, bytes memory data) public {
        push(TypeCasts.addressToBytes32(to), data);
    }

    function push(bytes32 to, bytes memory data) public {
        require(!complete, "callbatch has been completed");
        localCalls.push(GovernanceMessage.Call(to, data));
    }

    function writeCallList(
        JsonWriter.Buffer memory buffer,
        GovernanceMessage.Call[] storage calls,
        string memory domain
    ) private {
        buffer.writeArrayOpen(" ", domain);
        for (uint32 i = 0; i < calls.length; i++) {
            writeCall(buffer, " ", calls[i], i == calls.length - 1);
        }
        console2.log("Bufer contents", string(buffer.contents));
    }

    function writeLocal(JsonWriter.Buffer memory buffer) private {
        console2.log("writing local");
        buffer.writeObjectOpen("", "local");
        writeCallList(buffer, localCalls, localDomain);
        buffer.writeArrayClose(" ", true);
        buffer.writeObjectClose("", false);
    }

    function writeRemotes(JsonWriter.Buffer memory buffer) private {
        console2.log("writing remotes");
        buffer.writeObjectOpen("", "remote");
        for (uint256 j; j < remoteDomains.length; j++) {
            writeCallList(
                buffer,
                remoteCallsMap[remoteDomains[j]],
                remoteDomains[j]
            );
            buffer.writeArrayClose(" ", j == remoteDomains.length - 1);
        }
        buffer.writeObjectClose("", true);
    }

    function writeCall(
        JsonWriter.Buffer memory buffer,
        string memory indent,
        GovernanceMessage.Call storage call,
        bool terminal
    ) private {
        string memory inner = indent.nextIndent();
        buffer.writeLine(indent, "{");
        buffer.writeKv(inner, "to", vm.toString(call.to), false);
        buffer.writeKv(inner, "data", vm.toString(call.data), true);
        buffer.writeObjectClose(indent, terminal);
    }

    function finish() public {
        require(bytes(localDomain).length != 0, "must initialize");
        require(bytes(outputFile.path).length != 0, "must initialize");
        require(!complete, "already written");
        complete = true;
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        buffer.writeObjectOpen("", "");
        writeLocal(buffer);
        createRemoteCallsArray();
        writeRemotes(buffer);
        buffer.writeObjectClose("", true);
        buffer.flushTo(outputFile);
    }

    function build(address governanceRouter) public {
        require(
            remoteCalls.length == 0,
            "You need to pass an array of remote Domains"
        );
        build(governanceRouter, new uint32[](0));
    }

    GovernanceMessage.Call[] calls;

    function createRemoteCallsArray() public {
        for (uint256 i; i < remoteDomains.length; i++) {
            calls = remoteCallsMap[remoteDomains[i]];
            remoteCalls.push(calls);
        }
    }

    function build(
        address governanceRouter,
        uint32[] memory remoteDomainNumbers
    ) public {
        require(bytes(localDomain).length != 0, "must initialize");
        require(bytes(outputFile.path).length != 0, "must initialize");
        require(!complete, "already written");
        // if called via `build(address)`, remoteDomainNumber will be zero
        // and remoteBatches should be ignored
        if (remoteDomainNumbers.length != 0) {
            createRemoteCallsArray();
        }
        require(
            remoteDomainNumbers.length == remoteCalls.length,
            "wrong number of domain numbers"
        );
        complete = true;
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        bytes memory data = abi.encodeWithSelector(
            GovernanceRouter.executeGovernanceActions.selector,
            localCalls,
            remoteDomainNumbers,
            remoteCalls
        );
        string[2][] memory kvs = new string[2][](2);
        kvs[0][0] = "to";
        kvs[0][1] = vm.toString(governanceRouter);
        kvs[1][0] = "data";
        kvs[1][1] = vm.toString(data);
        buffer.writeSimpleObject("", "", kvs, true);
        buffer.flushTo(outputFile);
    }

    function prankExecuteBatch(address router) public {
        // prank the router itself to avoid governor chain issues
        vm.prank(router);
        GovernanceRouter(router).executeGovernanceActions(
            localCalls,
            new uint32[](0),
            new GovernanceMessage.Call[][](0)
        );
    }

    function prankRecoveryExecuteBatch(address router) public {
        // prank recovery (only works if recovery is active)
        address recovery = GovernanceRouter(router).recoveryManager();
        vm.prank(recovery);
        GovernanceRouter(router).executeGovernanceActions(
            localCalls,
            new uint32[](0),
            new GovernanceMessage.Call[][](0)
        );
    }
}

contract TestCallBatch is CallBatch {
    function combinedBuild() public {
        string memory local = "ethereum";
        string[] memory remotes = new string[](2);
        remotes[0] = "evmos";
        remotes[1] = "moonbeam";
        __CallBatch_initialize(local, remotes, "upgradeActions.json", true);
        bytes memory data = hex"0101";
        pushLocal(address(0xBEEF), data);
        pushRemote(address(0xBEEEEF), data, "evmos");
        pushRemote(address(0xBEEEEEEEF), data, "moonbeam");
        address govRouter = address(0xBEEFEFE);
        uint32[] memory remoteDomains = new uint32[](2);
        remoteDomains[0] = 123;
        remoteDomains[1] = 8843;
        build(govRouter, remoteDomains);
    }

    function combinedFinish() public {
        string memory local = "ethereum";
        string[] memory remotes = new string[](2);
        remotes[0] = "evmos";
        remotes[1] = "moonbeam";
        __CallBatch_initialize(local, remotes, "upgradeActions.json", true);
        bytes memory data = hex"0101";
        pushLocal(address(0xBEEF), data);
        pushRemote(address(0xBEEEEF), data, "evmos");
        pushRemote(address(0xBEEEEEEEF), data, "moonbeam");
        address govRouter = address(0xBEEFEFE);
        uint32[] memory remoteDomains = new uint32[](2);
        remoteDomains[0] = 123;
        remoteDomains[1] = 8843;
        finish();
    }

    function combinedLocal() public {
        string memory local = "ethereum";
        string[] memory remotes = new string[](2);
        remotes[0] = "evmos";
        remotes[1] = "moonbeam";
        __CallBatch_initialize(local, remotes, "upgradeActions.json", true);
        bytes memory data = hex"0101";
        pushLocal(address(0xBEEF), data);
        pushRemote(address(0xBEEEEF), data, "evmos");
        pushRemote(address(0xBEEEEEEEF), data, "moonbeam");
        address govRouter = address(0xBEEFEFE);
        uint32[] memory remoteDomains = new uint32[](2);
        remoteDomains[0] = 123;
        remoteDomains[1] = 8843;
        build(govRouter);
    }

    function finish(
        string memory _domain,
        string memory _outputFile,
        bool overwrite
    ) public {
        __CallBatch_initialize(_domain, _outputFile, overwrite);
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        finish();
    }

    function build(
        string memory _domain,
        string memory _outputFile,
        bool overwrite
    ) public {
        __CallBatch_initialize(_domain, _outputFile, overwrite);
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        build(address(34));
    }
}
