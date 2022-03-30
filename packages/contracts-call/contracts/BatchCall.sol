// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;
pragma experimental ABIEncoderV2;

// ============ External Imports ============
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

library BatchCall {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    // Batch message characteristics
    // * 1 item - the type
    uint256 private constant BATCH_PREFIX_ITEMS = 1;
    // * type is 1 byte long
    uint256 private constant BATCH_PREFIX_LEN = 1;
    // * Length of a Batch message
    // * type + batch hash
    uint256 private constant BATCH_MESSAGE_LEN = 1 + 32;

    // Serialized Call[] characteristics
    // * 1 item - the type
    uint256 private constant CALLS_PREFIX_ITEMS = 1;
    // * type is 1 byte long
    uint256 private constant CALLS_PREFIX_LEN = 1;

    // Serialized Call characteristics
    // * Location of the data blob in a serialized call
    // * address + length
    uint256 private constant CALL_DATA_OFFSET = 32 + 4;

    struct Call {
        bytes32 to;
        bytes data;
    }

    enum Types {
        Invalid, // 0
        Batch // 1 - A Batch message
    }

    modifier typeAssert(bytes29 _view, Types _t) {
        _view.assertType(uint40(_t));
        _;
    }

    // Read the type of a message
    function messageType(bytes29 _view) internal pure returns (Types) {
        return Types(uint8(_view.typeOf()));
    }

    // Read the message identifer (first byte) of a message
    function identifier(bytes29 _view) internal pure returns (uint8) {
        return uint8(_view.indexUint(0, 1));
    }

    /*
     *   Message Type: BATCH
     *   struct Call {
     *       identifier,     // message ID -- 1 byte
     *       batchHash       // Hash of serialized calls (see below) -- 32 bytes
     *   }
     *
     *   struct Call {
     *       to,         // address to call -- 32 bytes
     *       dataLen,    // call data length -- 4 bytes,
     *       data        // call data -- 0+ bytes (variable)
     *   }
     *
     *   struct Calls
     *       numCalls,   // number of calls -- 1 byte
     *       calls[]     // serialized Call -- 0+ bytes
     *   }
     */

    // create a Batch message from a list of calls
    function formatBatch(Call[] memory _calls)
    internal
    view
    returns (bytes memory)
    {
        return abi.encodePacked(Types.Batch, getBatchHash(_calls));
    }

    // serialize a call to memory and return a reference
    function serializeCall(Call memory _call) internal pure returns (bytes29) {
        return
        abi
        .encodePacked(_call.to, uint32(_call.data.length), _call.data)
        .ref(0);
    }

    function getBatchHash(Call[] memory _calls)
    internal
    view
    returns (bytes32)
    {
        // length prefix + 1 entry for each
        bytes29[] memory _encodedCalls = new bytes29[](
            _calls.length + CALLS_PREFIX_ITEMS
        );
        _encodedCalls[0] = abi.encodePacked(uint8(_calls.length)).ref(0);
        for (uint256 i = 0; i < _calls.length; i++) {
            _encodedCalls[i + CALLS_PREFIX_ITEMS] = serializeCall(_calls[i]);
        }
        return keccak256(TypedMemView.join(_encodedCalls));
    }

    function isValidBatch(bytes29 _view) internal pure returns (bool) {
        return
        identifier(_view) == uint8(Types.Batch) &&
        _view.len() == BATCH_MESSAGE_LEN;
    }

    function isBatch(bytes29 _view) internal pure returns (bool) {
        return isValidBatch(_view) && messageType(_view) == Types.Batch;
    }

    function tryAsBatch(bytes29 _view) internal pure returns (bytes29) {
        if (isValidBatch(_view)) {
            return _view.castTo(uint40(Types.Batch));
        }
        return TypedMemView.nullView();
    }

    function mustBeBatch(bytes29 _view) internal pure returns (bytes29) {
        return tryAsBatch(_view).assertValid();
    }

    // Types.Batch
    function batchHash(bytes29 _view) internal pure returns (bytes32) {
        return _view.index(BATCH_PREFIX_LEN, 32);
    }
}
