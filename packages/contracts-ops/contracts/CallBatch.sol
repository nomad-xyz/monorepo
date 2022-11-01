// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

// solhint-disable quotes

import {GovernanceMessage} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceMessage.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "forge-std/Script.sol";

abstract contract CallBatch is Script {
    GovernanceMessage.Call[] public calls;

    bool public complete;
    string public domain;
    string public outputFile;

    GovernanceMessage.Call built;

    function __CallBatch_initialize(
        string memory _domain,
        string memory _outputFile
    ) public {
        require(bytes(domain).length == 0, "already initialized");
        require(bytes(outputFile).length == 0, "already initialized");
        domain = _domain;
        outputFile = string(abi.encodePacked("./actions/", _outputFile));
    }

    function push(address to, bytes memory data) public {
        push(TypeCasts.addressToBytes32(to), data);
    }

    function push(bytes32 to, bytes memory data) public {
        require(!complete, "callbatch has been completed");
        calls.push(GovernanceMessage.Call(to, data));
    }

    function write(string memory indent, string memory line) private {
        vm.writeLine(outputFile, string(abi.encodePacked(indent, line)));
    }

    function writeKV(
        string memory indent,
        string memory key,
        string memory value,
        bool terminal
    ) private {
        string memory comma = terminal ? "" : ",";

        bytes memory line = abi.encodePacked(
            '"',
            key,
            '": "',
            value,
            '"',
            comma
        );
        write(indent, string(line));
    }

    function writeObjectBody(
        string memory indent,
        string[2][] memory kvs
    ) private {
        for (uint i = 0; i < kvs.length; i++) {
            writeKV(indent, kvs[i][0], kvs[i][1], i == kvs.length - 1);
        }
    }

    function writeArrayOpen(string memory indent, string memory key) private {
        bytes memory line = abi.encodePacked('"', key, '": [');
        write(indent, string(line));
    }

    function writeArrayClose(string memory indent, bool terminal) private {
        write(indent, terminal ? "]" : "],");
    }

    function writeSimpleObject(
        string memory indent,
        string[2][] memory kvs,
        bool terminal
    ) private {
        write(indent, "{");
        string memory inner = string(abi.encodePacked("  ", indent));
        writeObjectBody(inner, kvs);
        write(indent, terminal ? "}" : "},");
    }

    function writeSimpleNamedObject(
        string memory indent,
        string memory name,
        string[2][] memory kvs,
        bool terminal
    ) private {
        string memory open = string(abi.encodePacked(
            '"', name, '": {"'
        ));
        string memory inner = string(abi.encodePacked("  ", indent));
        write(indent, open);
        writeObjectBody(inner, kvs);
        write(indent, terminal ? "}" : "},");
    }

    function writeCall(
        string memory indent,
        GovernanceMessage.Call storage call,
        bool terminal
    ) private {
        write(indent, "{");

        string memory inner = string(abi.encodePacked(indent, "  "));
        writeKV(inner, "to", vm.toString(call.to), false);
        writeKV(inner, "data", vm.toString(call.data), true);

        string memory close = terminal ? "}" : "},";
        write(indent, close);
    }

    function writeOutput() private {
        string memory indent = "";
        string memory inner = "  ";
        string memory innerer = "    ";
        write(indent, "{");
        writeArrayOpen(inner, domain);
        for (uint32 i = 0; i < calls.length; i++) {
            writeCall(innerer, calls[i], i == calls.length - 1);
        }
        writeArrayClose(inner, true);
        write(indent, "}");
    }

    function finish() public {
        require(bytes(domain).length != 0, "must initialize");
        require(bytes(outputFile).length != 0, "must initialize");
        require(!complete, "already written");
        complete = true;
        writeOutput();
    }

    function build(address governanceRouter) public {
        require(bytes(domain).length != 0, "must initialize");
        require(bytes(outputFile).length != 0, "must initialize");
        require(!complete, "already written");
        complete = true;

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
        writeSimpleObject("", kvs, true);
    }
}

contract TestCallBatch is CallBatch {
    function finish(string memory _domain, string memory _outputFile) public {
        __CallBatch_initialize(_domain, _outputFile);
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        finish();
    }

    function build(string memory _domain, string memory _outputFile) public {
        __CallBatch_initialize(_domain, _outputFile);
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        build(address(34));
    }
}
