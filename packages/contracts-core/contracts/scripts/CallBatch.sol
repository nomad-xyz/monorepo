// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity 0.7.6;

import {GovernanceMessage} from "../governance/GovernanceMessage.sol";
import {TypeCasts} from "../XAppConnectionManager.sol";

import "forge-std/Script.sol";


abstract contract CallBatch is Script {
    GovernanceMessage.Call[] calls;

    string public domain;
    bool public complete;
    string public outputFile;

    constructor(string memory _domain, string memory _outputFile) {
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

    function writeKV(string memory indent, string memory key, string memory value, bool terminal) private {
        string memory comma = terminal ? "" : ",";

        bytes memory line = abi.encodePacked(
            "\"",
            key,
            "\": \"",
            value,
            "\"",
            comma
        );
        write(indent, string(line));
    }

    function writeArrayOpen(string memory indent, string memory key) private {
        bytes memory line = abi.encodePacked(
            "\"",
            key,
            "\": ["
        );
        write(indent, string(line));
    }

    function writeArrayClose(string memory indent, bool terminal) private {
        write(indent, terminal ? "]" : "],");
    }

    function writeCall(string memory indent, GovernanceMessage.Call storage call, bool terminal) private {
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
        complete = true;
        writeOutput();
    }
}

contract TestCallBatch is CallBatch {

    constructor() CallBatch("hello world", "test.json") {}

    function run() public {
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        push(address(3), bytes("abcd"));
        finish();
    }
}
