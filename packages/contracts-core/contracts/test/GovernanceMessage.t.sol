// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {GovernanceMessage} from "../governance/GovernanceMessage.sol";

contract GovernanceMessageTest is Test {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using GovernanceMessage for bytes29;

    function setUp() public {}

    function test_typesSetToCorrectOrder() public {
        assertEq(uint256(GovernanceMessage.Types.Invalid), 0);
        assertEq(uint256(GovernanceMessage.Types.Batch), 1);
        assertEq(uint256(GovernanceMessage.Types.TransferGovernor), 2);
    }

    // Check the type of the data from the type of the TypedMemView
    // view
    function test_messageTypeCorrectRead() public {
        bytes memory data = "whatever";
        assertEq(uint256(data.ref(0).messageType()), 0);
        assertEq(uint256(data.ref(1).messageType()), 1);
        assertEq(uint256(data.ref(2).messageType()), 2);
    }

    // Check the type of the data from the first byte of the bytes
    // array, not from the view
    function test_identifierReadsFirstByte() public {
        bytes memory data = hex"00";
        assertEq(uint256(data.ref(0).identifier()), 0);
        data = hex"01";
        assertEq(uint256(data.ref(0).identifier()), 1);
        data = hex"02";
        assertEq(uint256(data.ref(0).identifier()), 2);
    }

    function test_serializeCall() public {
        bytes32 to = "0xBEEF";
        bytes memory data = "random data";
        GovernanceMessage.Call memory call = GovernanceMessage.Call(to, data);
        bytes29 serializedCall = abi
            .encodePacked(to, uint32(data.length), data)
            .ref(0);
        assertEq(
            GovernanceMessage.serializeCall(call).keccak(),
            serializedCall.keccak()
        );
    }

    function test_serializeCallFuzzed(bytes32 to, bytes memory data) public {
        GovernanceMessage.Call memory call = GovernanceMessage.Call(to, data);
        bytes29 serializedCall = abi
            .encodePacked(to, uint32(data.length), data)
            .ref(0);
        assertEq(
            GovernanceMessage.serializeCall(call).keccak(),
            serializedCall.keccak()
        );
    }

    function test_formatBatchSingleCall() public {
        bytes32 to = "0xBEEF";
        bytes memory data = "random data";
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](1);
        calls[0] = GovernanceMessage.Call(to, data);
        assertEq(
            GovernanceMessage.formatBatch(calls),
            abi.encodePacked(
                GovernanceMessage.Types.Batch,
                GovernanceMessage.getBatchHash(calls)
            )
        );
    }

    function test_formatBatchSingleCallFuzzed(bytes32 to, bytes memory data)
        public
    {
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](1);
        calls[0] = GovernanceMessage.Call(to, data);
        assertEq(
            GovernanceMessage.formatBatch(calls),
            abi.encodePacked(
                GovernanceMessage.Types.Batch,
                GovernanceMessage.getBatchHash(calls)
            )
        );
    }

    function test_getBatchHash() public {
        // we only have 1 call
        bytes memory prefix = hex"01";
        bytes32 to = "0xBEEF";
        bytes memory data = "random data";
        bytes memory serializedCall = abi.encodePacked(
            to,
            uint32(data.length),
            data
        );
        bytes memory batch = abi.encodePacked(prefix, serializedCall);
        bytes32 batchHash = keccak256(batch);
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](1);
        calls[0] = GovernanceMessage.Call(to, data);
        assertEq(GovernanceMessage.getBatchHash(calls), batchHash);
    }

    function test_getBatchHashFuzzedIdenticalCalls(
        bytes memory data,
        bytes32 to,
        uint8 nbrOfCalls
    ) public {
        vm.assume(nbrOfCalls > 0);
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](
            nbrOfCalls
        );
        bytes memory serializedCall = abi.encodePacked(
            to,
            uint32(data.length),
            data
        );
        bytes memory prefix = abi.encodePacked(nbrOfCalls);
        bytes memory batch = prefix;
        for (uint256 i = 0; i < nbrOfCalls; i++) {
            calls[i] = GovernanceMessage.Call(to, data);
            batch = abi.encodePacked(batch, serializedCall);
        }
        bytes32 batchHash = keccak256(batch);
        assertEq(GovernanceMessage.getBatchHash(calls), batchHash);
    }

    // storage array that persists between fuzzing test calls,
    // allowing us to create a batch of many fuzzed calls
    GovernanceMessage.Call[] diffCalls;

    function test_getBatchHashFuzzedDifferentCalls(
        bytes memory data,
        bytes32 to
    ) public {
        bytes memory serializedCall = abi.encodePacked(
            to,
            uint32(data.length),
            data
        );
        diffCalls.push(GovernanceMessage.Call(to, data));
        // The maximum size of a batch is 64 Calls
        // After that, we reset the state and we fuzz the next batch with 64 new calls
        // We reset the state by `delete`ing the storage array and using the same data
        // structure to store the next 64 fuzzed Calls
        if (diffCalls.length == type(uint8).max) {
            bytes memory prefix = abi.encodePacked(uint8(diffCalls.length));
            bytes memory batch = prefix;
            for (uint256 i = 0; i < type(uint8).max; i++) {
                batch = abi.encodePacked(batch, serializedCall);
            }
            bytes32 batchHash = keccak256(batch);
            assertEq(GovernanceMessage.getBatchHash(diffCalls), batchHash);
            delete diffCalls;
        }
    }
}
