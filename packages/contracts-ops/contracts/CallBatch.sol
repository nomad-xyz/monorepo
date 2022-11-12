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

    string localDomainName;
    uint32 public localDomain;
    GovernanceMessage.Call[] public localCalls;
    uint32[] public remoteDomains;
    mapping(uint32 => GovernanceMessage.Call[]) public remoteCalls;

    bool public written;
    JsonWriter.File outputFile;

    function __CallBatch_initialize(
        string memory _localDomainName,
        uint32 _localDomain,
        string memory _outputFilePath,
        bool _overwrite
    ) public {
        require(localDomain == 0, "already initialized");
        require(_localDomain != 0, "can't pass zero domain");
        localDomainName = _localDomainName;
        localDomain = _localDomain;
        outputFile.overwrite = _overwrite;
        outputFile.path = string(
            abi.encodePacked("./actions/", _outputFilePath)
        );
    }

    function pushRemote(
        address to,
        bytes memory data,
        uint32 domain
    ) public {
        require(!written, "callbatch has been completed");
        // if no calls have been pushed for this domain previously, add to array of remote domains
        if (remoteCalls[domain].length == 0) {
            remoteDomains.push(domain);
        }
        // push to array of calls for this domain
        remoteCalls[domain].push(
            GovernanceMessage.Call(TypeCasts.addressToBytes32(to), data)
        );
    }

    function pushLocal(address to, bytes memory data) public {
        pushLocal(TypeCasts.addressToBytes32(to), data);
    }

    function pushLocal(bytes32 to, bytes memory data) public {
        require(!written, "callbatch has been completed");
        localCalls.push(GovernanceMessage.Call(to, data));
    }

    // only works if recovery is not active and localDomain is governor domain
    function prankExecuteGovernor(address router) public {
        // prank governor
        address gov = GovernanceRouter(router).governor();
        require(gov != address(0), "!gov chain");
        vm.prank(gov);
        // execute local & remote calls
        // NOTE: remote calls will be sent as Nomad message
        GovernanceRouter(router).executeGovernanceActions(
            localCalls,
            remoteDomains,
            buildRemoteCalls()
        );
    }

    // only works if recovery is active on specified domain
    function prankExecuteRecoveryManager(address router, uint32 domain) public {
        // prank recovery manager
        address rm = GovernanceRouter(router).recoveryManager();
        require(GovernanceRouter(router).inRecovery(), "!in recovery");
        vm.prank(rm);
        // get calls only for specified domain
        GovernanceMessage.Call[] memory _domainCalls;
        if (domain == localDomain) {
            _domainCalls = localCalls;
        } else {
            _domainCalls = remoteCalls[domain];
        }
        // execute local calls
        GovernanceRouter(router).executeGovernanceActions(
            _domainCalls,
            new uint32[](0),
            new GovernanceMessage.Call[][](0)
        );
    }

    function writeCall(
        JsonWriter.Buffer memory buffer,
        string memory indent,
        GovernanceMessage.Call storage call,
        bool terminal
    ) private {
        buffer.writeObjectOpen(indent);
        string memory inner = indent.nextIndent();
        buffer.writeKv(inner, "to", vm.toString(call.to), false);
        buffer.writeKv(inner, "data", vm.toString(call.data), true);
        buffer.writeObjectClose(indent, terminal);
    }

    function writeCallList(
        JsonWriter.Buffer memory buffer,
        string memory indent,
        GovernanceMessage.Call[] storage calls
    ) private {
        for (uint32 i = 0; i < calls.length; i++) {
            writeCall(
                buffer,
                indent.nextIndent(),
                calls[i],
                i == calls.length - 1
            );
        }
    }

    function writeLocal(JsonWriter.Buffer memory buffer, string memory indent)
        private
    {
        buffer.writeArrayOpen(indent, "local");
        writeCallList(buffer, indent, localCalls);
        buffer.writeArrayClose(indent, false);
    }

    function writeRemotes(JsonWriter.Buffer memory buffer, string memory indent)
        private
    {
        if (remoteDomains.length == 0) return;
        buffer.writeObjectOpen(indent, "remote");
        for (uint256 j; j < remoteDomains.length; j++) {
            string memory inner = indent.nextIndent();
            buffer.writeArrayOpen(
                inner,
                vm.toString(uint256(remoteDomains[j]))
            );
            writeCallList(buffer, inner, remoteCalls[remoteDomains[j]]);
            bool terminal = j == remoteDomains.length - 1;
            buffer.writeArrayClose(inner, terminal);
        }
        buffer.writeObjectClose(indent, false);
    }

    function writeRecoveryData(
        JsonWriter.Buffer memory buffer,
        string memory indent,
        uint32 domain,
        GovernanceMessage.Call[] memory calls,
        bool isLastDomain
    ) private {
        buffer.writeObjectOpen(indent, vm.toString(uint256(domain)));
        bytes memory data = abi.encodeWithSelector(
            GovernanceRouter.executeGovernanceActions.selector,
            calls,
            new uint32[](0),
            new GovernanceMessage.Call[][](0)
        );
        string memory inner = indent.nextIndent();
        buffer.writeKv(inner, "data", vm.toString(data), true);
        buffer.writeObjectClose(indent, isLastDomain);
    }

    function writeGovernorData(
        JsonWriter.Buffer memory buffer,
        string memory indent
    ) private {
        bytes memory data = abi.encodeWithSelector(
            GovernanceRouter.executeGovernanceActions.selector,
            localCalls,
            remoteDomains,
            buildRemoteCalls()
        );
        buffer.writeKv(indent, "data", vm.toString(data), true);
    }

    function writeBuilt(
        JsonWriter.Buffer memory buffer,
        string memory indent,
        bool recovery
    ) private {
        buffer.writeObjectOpen(indent, "built");
        string memory inner = indent.nextIndent();
        if (recovery) {
            // write local domain built
            bool isLastDomain = remoteDomains.length == 0;
            writeRecoveryData(
                buffer,
                inner,
                localDomain,
                localCalls,
                isLastDomain
            );
            // write remote domains built
            for (uint256 j; j < remoteDomains.length; j++) {
                isLastDomain = j == remoteDomains.length - 1;
                writeRecoveryData(
                    buffer,
                    inner,
                    remoteDomains[j],
                    remoteCalls[remoteDomains[j]],
                    isLastDomain
                );
            }
        } else {
            writeGovernorData(buffer, inner);
        }
        buffer.writeObjectClose(indent, true);
    }

    GovernanceMessage.Call[][] private builtRemoteCalls;

    function buildRemoteCalls()
        private
        returns (GovernanceMessage.Call[][] memory _remoteCalls)
    {
        for (uint256 i; i < remoteDomains.length; i++) {
            builtRemoteCalls.push(remoteCalls[remoteDomains[i]]);
        }
        _remoteCalls = builtRemoteCalls;
    }

    function writeCallBatch(bool recovery) public {
        require(localDomain != 0, "must initialize");
        require(!written, "already written");
        // write raw local & remote calls to file
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        string memory indent = "";
        string memory inner = indent.nextIndent();
        buffer.writeObjectOpen(indent);
        writeLocal(buffer, inner);
        writeRemotes(buffer, inner);
        writeBuilt(buffer, inner, recovery);
        buffer.writeObjectClose(indent, true);
        buffer.flushTo(outputFile);
        // finish
        written = true;
    }
}

contract TestCallBatch is CallBatch {
    // multi chain calls, recovery mode
    function writeRecoveryMulti() public {
        string memory localName = "ethereum";
        uint32 local = 1111;
        __CallBatch_initialize(localName, local, "upgradeActions.json", true);
        bytes memory data = hex"0101";
        pushLocal(address(0xBEEF), data);
        pushRemote(address(0xBEEEEF), data, 2222);
        pushRemote(address(0xBEEEEEEEF), data, 3333);
        writeCallBatch(true);
    }

    // multi chain calls, governance mode
    function writeGovernanceMulti() public {
        string memory localName = "ethereum";
        uint32 local = 1111;
        __CallBatch_initialize(localName, local, "upgradeActions.json", true);
        bytes memory data = hex"0101";
        pushLocal(address(0xBEEF), data);
        pushRemote(address(0xBEEEEF), data, 2222);
        pushRemote(address(0xBEEEEEEEF), data, 3333);
        writeCallBatch(false);
    }

    // single chain calls, recovery mode
    function writeRecoverySingle() public {
        string memory localName = "ethereum";
        uint32 local = 1111;
        __CallBatch_initialize(localName, local, "upgradeActions.json", true);
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        writeCallBatch(true);
    }

    // single chain calls, governance mode
    // (data should be same as single chain recovery mode)
    function writeGovernanceSingle() public {
        string memory localName = "ethereum";
        uint32 local = 1111;
        __CallBatch_initialize(localName, local, "upgradeActions.json", true);
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        pushLocal(address(3), bytes("abcd"));
        writeCallBatch(false);
    }
}
