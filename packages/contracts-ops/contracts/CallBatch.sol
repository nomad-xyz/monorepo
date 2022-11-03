// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

// solhint-disable quotes

import {GovernanceMessage} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceMessage.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "./JsonWriter.sol";

import "forge-std/Script.sol";

abstract contract CallBatch is Script {
    using JsonWriter for JsonWriter.Buffer;
    using JsonWriter for string;

    GovernanceMessage.Call[] public calls;

    bool public complete;
    string public domain;
    JsonWriter.File outputFile;

    function __CallBatch_initialize(
        string memory _domain,
        string memory _outputFile,
        bool _overwrite
    ) public {
        require(bytes(domain).length == 0, "already initialized");
        require(bytes(outputFile.path).length == 0, "already initialized");
        domain = _domain;
        _outputFile = string(abi.encodePacked("./actions/", _outputFile));
        outputFile.path = _outputFile;
        outputFile.overwrite = _overwrite;
    }

    function push(address to, bytes memory data) public {
        push(TypeCasts.addressToBytes32(to), data);
    }

    function push(bytes32 to, bytes memory data) public {
        require(!complete, "callbatch has been completed");
        calls.push(GovernanceMessage.Call(to, data));
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

    function writeCallList(JsonWriter.Buffer memory buffer) private {
        string memory indent = "";
        string memory inner = indent.nextIndent();
        string memory innerer = inner.nextIndent();
        buffer.writeLine(indent, "{");
        buffer.writeArrayOpen(inner, domain);
        for (uint32 i = 0; i < calls.length; i++) {
            writeCall(buffer, innerer, calls[i], i == calls.length - 1);
        }
        buffer.writeArrayClose(inner, true);
        buffer.writeLine(indent, "}");
    }

    function finish() public {
        require(bytes(domain).length != 0, "must initialize");
        require(bytes(outputFile.path).length != 0, "must initialize");
        require(!complete, "already written");
        complete = true;
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        writeCallList(buffer);
        buffer.flushTo(outputFile);
    }

    function build(address governanceRouter) public {
        require(bytes(domain).length != 0, "must initialize");
        require(bytes(outputFile.path).length != 0, "must initialize");
        require(!complete, "already written");
        complete = true;
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        bytes memory data = abi.encodeWithSelector(
            GovernanceRouter.executeGovernanceActions.selector,
            calls,
            new uint32[](0),
            new GovernanceMessage.Call[][](0)
        );
        string[2][] memory kvs = new string[2][](2);
        kvs[0][0] = "to";
        kvs[0][1] = vm.toString(governanceRouter);
        kvs[1][0] = "data";
        kvs[1][1] = vm.toString(data);
        buffer.writeSimpleObject("", "", kvs, true);
        buffer.flushTo(outputFile);
    }

    function prank(address router) public {
        // prank the router itself to avoid governor chain issues
        vm.prank(router);
        GovernanceRouter(router).executeGovernanceActions(
            calls,
            new uint32[](0),
            new GovernanceMessage.Call[][](0)
        );
    }

    function prankRecovery(address router) public {
        // prank recovery (only works if recovery is active)
        address recovery = GovernanceRouter(router).recoveryManager();
        vm.prank(recovery);
        GovernanceRouter(router).executeGovernanceActions(
            calls,
            new uint32[](0),
            new GovernanceMessage.Call[][](0)
        );
    }
}

contract TestCallBatch is CallBatch {
    function finish(
        string memory _domain,
        string memory _outputFile,
        bool overwrite
    ) public {
        __CallBatch_initialize(_domain, _outputFile, overwrite);
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        finish();
    }

    function build(
        string memory _domain,
        string memory _outputFile,
        bool overwrite
    ) public {
        __CallBatch_initialize(_domain, _outputFile, overwrite);
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        build(address(34));
    }
}
