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
        uint8 numCalls
    ) public {
        vm.assume(numCalls > 0);
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](
            numCalls
        );
        bytes memory serializedCall = abi.encodePacked(
            to,
            uint32(data.length),
            data
        );
        bytes memory prefix = abi.encodePacked(numCalls);
        bytes memory batch = prefix;
        for (uint256 i = 0; i < numCalls; i++) {
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
        bytes[255] memory data,
        bytes32[255] memory to
    ) public {
        // types(uint8).max = 255
        bytes memory serializedCall;
        bytes memory prefix = abi.encodePacked(uint8(255));
        bytes memory batch = prefix;
        for (uint256 i; i < data.length; i++) {
            diffCalls.push(GovernanceMessage.Call(to[i], data[i]));
            serializedCall = abi.encodePacked(
                to[i],
                uint32(data[i].length),
                data[i]
            );
            batch = abi.encodePacked(batch, serializedCall);
        }
        bytes32 batchHash = keccak256(batch);
        assertEq(GovernanceMessage.getBatchHash(diffCalls), batchHash);
    }

    function test_isValidBatchDetectBatch() public pure {
        // batch type in the form of a uint8
        bytes memory data = hex"01";
        // Append an empty bytes array of 32 bytes
        data = abi.encodePacked(data, new bytes(32));
        assert(GovernanceMessage.isValidBatch(data.ref(0)));
    }

    function test_isValidBatchDetectBatchFuzzed(bytes32 data) public pure {
        bytes memory dataByte = abi.encodePacked(hex"01", data);
        assert(GovernanceMessage.isValidBatch(dataByte.ref(0)));
    }

    function test_isValidBatchWrongIdentifier() public {
        // batch type in the form of a uint8
        bytes memory data = hex"02";
        // Append an empty bytes array of 32 bytes
        data = abi.encodePacked(data, new bytes(32));
        assertFalse(GovernanceMessage.isValidBatch(data.ref(0)));
    }

    function test_isValidBatchWrongIdentifierFuzzed(uint8 viewType) public {
        // batch type in the form of a uint8
        // Append an empty bytes array of 32 bytes
        bytes memory data = abi.encodePacked(
            abi.encodePacked(viewType),
            new bytes(32)
        );
        if (viewType == 1) {
            assert(GovernanceMessage.isValidBatch(data.ref(0)));
        } else {
            assertFalse(GovernanceMessage.isValidBatch(data.ref(0)));
        }
    }

    function test_isValidBatchWrongIdentifierFuzzed(
        uint8 viewType,
        bytes32 data
    ) public {
        vm.assume(viewType != 1);
        bytes memory dataByte = abi.encodePacked(
            abi.encodePacked(viewType),
            data
        );
        assertFalse(GovernanceMessage.isValidBatch(dataByte.ref(0)));
    }

    function test_isValidBatchWrongLength() public {
        // batch type in the form of a uint8
        bytes memory data = hex"01";
        // Append an empty bytes array of 23 bytes
        data = abi.encodePacked(data, new bytes(23));
        assertFalse(GovernanceMessage.isValidBatch(data.ref(0)));
    }

    function test_isValidBatchWrongLengthFuzzed(bytes memory data) public {
        vm.assume(data.length != 32);
        data = abi.encodePacked(hex"01", data);
        assertFalse(GovernanceMessage.isValidBatch(data.ref(0)));
    }

    function test_isBatchDetectsViewType() public {
        bytes memory data = hex"01";
        // Append an empty bytes array of 32 bytes
        data = abi.encodePacked(data, new bytes(32));
        assert(GovernanceMessage.isBatch(data.ref(1)));
        assertFalse(GovernanceMessage.isBatch(data.ref(2)));
    }

    function test_isBatchDetectsViewTypeFuzzed(uint8 viewType, bytes32 data)
        public
    {
        bytes memory prefix = abi.encodePacked(viewType);
        // Append an empty bytes array of 32 bytes
        bytes memory dataByte = abi.encodePacked(prefix, data);
        if (viewType == 1) {
            assert(GovernanceMessage.isBatch(dataByte.ref(viewType)));
        } else {
            assertFalse(GovernanceMessage.isBatch(dataByte.ref(viewType)));
        }
    }

    function test_isBatchDifferentViewTypeToPrefixFuzzed(
        uint8 viewType,
        bytes32 data
    ) public {
        vm.assume(viewType < 3);
        // the prefix is different to the type of the view
        bytes memory prefix = hex"01";
        // Append an empty bytes array of 32 bytes
        bytes memory dataByte = abi.encodePacked(prefix, data);
        if (viewType == 1) {
            assert(GovernanceMessage.isBatch(dataByte.ref(viewType)));
        } else {
            assertFalse(GovernanceMessage.isBatch(dataByte.ref(viewType)));
        }
    }

    function test_tryAsBatchForBatchReturnsBatch() public {
        bytes memory data = hex"01";
        // Appnend an empty bytes array of 32 bytes
        data = abi.encodePacked(data, new bytes(32));
        bytes29 dataView = data.ref(1);
        // We compare both the type of the view and the contents of the memory location
        // to where the view points
        assertEq(uint256(dataView.tryAsBatch().typeOf()), 1);
        assertEq(dataView.tryAsBatch().keccak(), dataView.keccak());
        dataView = data.ref(34);
        // even if instantiate the view with a differerent type, it can still
        // be cast to a Batch type (1)
        assertEq(uint256(dataView.tryAsBatch().typeOf()), 1);
        assertEq(dataView.tryAsBatch().keccak(), dataView.keccak());
    }

    function test_tryAsBatchForBatchReturnsBatchFuzzed(uint40 viewType) public {
        bytes memory data = hex"01";
        // Append an empty bytes array of 32 bytes
        data = abi.encodePacked(data, new bytes(32));
        bytes29 dataView = data.ref(viewType);
        // We compare both the type of the view and the contents of the memory location
        // to where the view points
        assertEq(uint256(dataView.tryAsBatch().typeOf()), 1);
        assertEq(dataView.tryAsBatch().keccak(), dataView.keccak());
    }

    function test_tryAsBatchForNonBatchReturnsNull() public {
        // not a batch
        bytes memory data = hex"03";
        // Append an empty bytes array of 32 bytes
        data = abi.encodePacked(data, new bytes(32));
        bytes29 dataView = data.ref(1);
        assertEq(dataView.tryAsBatch(), TypedMemView.nullView());
    }

    function test_batchHashSingleCall() public {
        bytes32 to = "0xBEEF";
        bytes memory data = "random data";
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](1);
        calls[0] = GovernanceMessage.Call(to, data);
        assertEq(
            // format Batch, instantiate view, get batchHash of that view
            GovernanceMessage.formatBatch(calls).ref(0).batchHash(),
            // get batch hash of the calls
            GovernanceMessage.getBatchHash(calls)
        );
    }

    function test_formatTransferGovernor() public {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(2), domain, governor);
        assertEq(
            data,
            GovernanceMessage.formatTransferGovernor(domain, governor)
        );
    }

    function test_formatTransferGovernorFuzzed(uint32 domain, bytes32 governor)
        public
    {
        bytes memory data = abi.encodePacked(uint8(2), domain, governor);
        assertEq(
            data,
            GovernanceMessage.formatTransferGovernor(domain, governor)
        );
    }

    function test_isValidTransferGovernorSuccess() public pure {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(2), domain, governor);
        // it doesn't check the type of the view
        assert(GovernanceMessage.isValidTransferGovernor(data.ref(0)));
    }

    function test_isValidTrasnferGovernorWrongType() public {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(0), domain, governor);
        // it doesn't check the type of the view
        assertFalse(GovernanceMessage.isValidTransferGovernor(data.ref(0)));
        data = abi.encodePacked(uint8(1), domain, governor);
        // it doesn't check the type of the view
        assertFalse(GovernanceMessage.isValidTransferGovernor(data.ref(0)));
    }

    function test_isValidTrasnferGovernorWrongLength() public {
        uint96 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(0), domain, governor);
        // it doesn't check the type of the view
        assertFalse(GovernanceMessage.isValidTransferGovernor(data.ref(0)));
    }

    function test_isValidTransferGovernorFuzzed(
        uint8 messageType,
        uint32 domain,
        bytes32 governor
    ) public {
        bytes memory data = abi.encodePacked(messageType, domain, governor);
        // it doesn't check the type of the view
        if (messageType == 2) {
            assert(GovernanceMessage.isValidTransferGovernor(data.ref(0)));
        } else {
            assertFalse(GovernanceMessage.isValidTransferGovernor(data.ref(0)));
        }
    }

    function test_isTransferGovernorVerifyCorrectTypeAndForm() public {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(2), domain, governor);
        // it doesn't check the type of the view
        assert(GovernanceMessage.isTransferGovernor(data.ref(2)));
        assertFalse(GovernanceMessage.isTransferGovernor(data.ref(0)));
    }

    function test_isTransferGovernorVerifyCorrectTypeAndFormFuzzed(
        uint32 domain,
        bytes32 governor,
        uint8 viewType
    ) public {
        bytes memory data = abi.encodePacked(viewType, domain, governor);
        // it doesn't check the type of the view
        if (viewType == 2) {
            assert(GovernanceMessage.isTransferGovernor(data.ref(viewType)));
        } else {
            assertFalse(
                GovernanceMessage.isTransferGovernor(data.ref(viewType))
            );
        }
    }

    function test_tryAsTransferGovernorCorrectPrefix() public {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(2), domain, governor);
        assertEq(
            uint256(
                GovernanceMessage.tryAsTransferGovernor(data.ref(0)).typeOf()
            ),
            2
        );
    }

    function test_tryAsTransferGovernorWrongPrefix() public {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(1), domain, governor);
        assertEq(
            GovernanceMessage.tryAsTransferGovernor(data.ref(0)),
            TypedMemView.nullView()
        );
    }

    function test_tryAsTransferGovernorCorrectPrefixFuzzed(
        uint32 domain,
        bytes32 governor,
        uint40 viewType
    ) public {
        bytes memory data = abi.encodePacked(uint8(2), domain, governor);
        assertEq(
            uint256(
                GovernanceMessage
                    .tryAsTransferGovernor(data.ref(viewType))
                    .typeOf()
            ),
            2
        );
    }

    function test_mustBeTransferGovernorSuccess() public {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(2), domain, governor);
        assertEq(
            GovernanceMessage.mustBeTransferGovernor(data.ref(0)),
            data.ref(2)
        );
    }

    function test_mustBeTransferGovernorSuccessFuzzed(
        uint32 domain,
        bytes32 governor
    ) public {
        bytes memory data = abi.encodePacked(uint8(2), domain, governor);
        assertEq(
            GovernanceMessage.mustBeTransferGovernor(data.ref(0)),
            data.ref(2)
        );
    }

    function test_mustBeTransferGovernorRevert() public {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(234), domain, governor);
        vm.expectRevert("Validity assertion failed");
        GovernanceMessage.mustBeTransferGovernor(data.ref(0));
    }

    function test_mustBeTransferGovernorRevertFuzzed(
        uint32 domain,
        bytes32 governor,
        uint8 viewType
    ) public {
        vm.assume(viewType != 2);
        bytes memory data = abi.encodePacked(viewType, domain, governor);
        vm.expectRevert("Validity assertion failed");
        GovernanceMessage.mustBeTransferGovernor(data.ref(0));
    }

    function test_extractGovernorMessageDetails() public {
        uint32 domain = 123;
        bytes32 governor = "all hail to the new governor";
        bytes memory data = abi.encodePacked(uint8(234), domain, governor);
        assertEq(uint256(data.ref(0).domain()), domain);
        assertEq(data.ref(0).governor(), governor);
    }

    function test_extractGovernorMessageDetailsFuzzed(
        bytes32 governor,
        uint32 domain,
        uint8 viewType
    ) public {
        bytes memory data = abi.encodePacked(viewType, domain, governor);
        assertEq(uint256(data.ref(0).domain()), domain);
        assertEq(data.ref(0).governor(), governor);
    }
}
