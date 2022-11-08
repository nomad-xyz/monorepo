// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

// solhint-disable quotes

import {GovernanceMessage} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceMessage.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import {JsonWriter} from "./JsonWriter.sol";

import "forge-std/Script.sol";

abstract contract CallBatch is Script {
    using JsonWriter for JsonWriter.Buffer;
    using JsonWriter for string;

    GovernanceMessage.Call[] public localCalls;
    GovernanceMessage.Call[][] public remoteCalls;

    bool public complete;
    string public localDomain;
    string[] public remoteDomains;
    JsonWriter.File outputFileLocal;
    JsonWriter.File outputFileRemote;
    JsonWriter.File outputFileCombined;

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
        string memory _outputFile,
        bool _overwrite
    ) public {
        require(bytes(_localDomain).length == 0, "already initialized");
        require(bytes(outputFileLocal.path).length == 0, "already initialized");
        localDomain = _localDomain;
        remoteDomains = _remoteDomains;
        _outputFile = string(abi.encodePacked("./actions/", _outputFile));
        outputFileLocal.path = string(abi.encodePacked("local-", _outputFile));
        outputFileLocal.overwrite = _overwrite;
        outputFileRemote.path = string(
            abi.encodePacked("remote-", _outputFile)
        );
        outputFileRemote.overwrite = _overwrite;
        outputFileCombined.path = string(
            abi.encodePacked("combined-", _outputFile)
        );
        outputFileCombined.overwrite = _overwrite;
    }

    function pushRemote(
        address to,
        bytes memory data,
        string memory domain
    ) public {
        for (uint256 i; i < remoteDomains.length; i++) {
            if (
                keccak256(abi.encodePacked(domain)) ==
                keccak256(abi.encodePacked(remoteDomains[i]))
            ) {
                remoteCalls[i].push(
                    GovernanceMessage.Call(TypeCasts.addressToBytes32(to), data)
                );
            }
        }
    }

    function pushLocal(address to, bytes memory data) public {
        push(TypeCasts.addressToBytes32(to), data);
    }

    function push(bytes32 to, bytes memory data) public {
        require(!complete, "callbatch has been completed");
        localCalls.push(GovernanceMessage.Call(to, data));
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

    function writeCallList(JsonWriter.Buffer memory buffer, bool local)
        private
    {
        if (local) {
            string memory indent = "";
            string memory inner = indent.nextIndent();
            string memory innerer = inner.nextIndent();
            buffer.writeLine(indent, "{");
            buffer.writeArrayOpen(inner, localDomain);
            for (uint32 i = 0; i < localCalls.length; i++) {
                writeCall(
                    buffer,
                    innerer,
                    localCalls[i],
                    i == localCalls.length - 1
                );
            }
            buffer.writeArrayClose(inner, true);
            buffer.writeLine(indent, "}");
        } else {
            for (uint256 j; j < remoteDomains.length; j++) {
                string memory indent = "";
                string memory inner = indent.nextIndent();
                string memory innerer = inner.nextIndent();
                buffer.writeLine(indent, "{");
                buffer.writeArrayOpen(inner, remoteDomains[j]);
                for (uint32 i = 0; i < remoteCalls[j].length; i++) {
                    writeCall(
                        buffer,
                        innerer,
                        remoteCalls[j][i],
                        i == remoteCalls[j].length - 1
                    );
                }
                buffer.writeArrayClose(inner, true);
                buffer.writeLine(indent, "}");
            }
        }
    }

    function finish() public {
        require(bytes(localDomain).length != 0, "must initialize");
        require(bytes(outputFileLocal.path).length != 0, "must initialize");
        require(!complete, "already written");
        complete = true;
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        writeCallList(buffer, true);
        buffer.flushTo(outputFileLocal);

        buffer = JsonWriter.newBuffer();
        writeCallList(buffer, false);
        buffer.flushTo(outputFileRemote);
    }

    function build(address governanceRouter) public {
        require(
            remoteCalls.length == 0,
            "You need to pass an array of remote Domains"
        );
        build(governanceRouter, new uint32[](0));
    }

    function build(
        address governanceRouter,
        uint32[] memory remoteDomainNumbers
    ) public {
        require(bytes(localDomain).length != 0, "must initialize");
        require(bytes(outputFileLocal.path).length != 0, "must initialize");
        require(!complete, "already written");
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
        if (remoteCalls.length == 0) {
            buffer.flushTo(outputFileLocal);
        } else {
            buffer.flushTo(outputFileCombined);
        }
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
