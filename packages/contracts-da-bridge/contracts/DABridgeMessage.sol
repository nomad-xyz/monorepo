// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "@summa-tx/memview-sol/contracts/TypedMemView.sol";

library DABridgeMessage {
    // ============ Libraries ============

    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    // ============ Enums ============

    // WARNING: do NOT re-write the numbers / order
    // of message types in an upgrade;
    // will cause in-flight messages to be mis-interpreted
    // The Types enum has to do with the TypedMemView library and it defines
    // the types of `views` that we use in BridgeMessage. A view is not interesting data
    // itself, but rather it points to a specific part of the memory where
    // the data we care about live. When we give a `type` to a view, we define what type
    // is the data it points to, so that we can do easy runtime assertions without
    // having to fetch the whole data from memory and check for ourselves. In BridgeMessage.sol
    // the types of `data` we can have are defined in this enum and may belong to different taxonomies.

    enum Types {
        Invalid, // 0
        DataRoot // 1
    }

    // ============ Constants ============

    uint256 private constant IDENTIFIER_LEN = 1;
    uint256 private constant BLOCK_NUMBER_LEN = 4;
    uint256 private constant DATA_ROOT_LEN = 32;

    // ============ Internal Functions ============

    /**
     * @notice Read the message identifer (first byte) of a message
     * @param _view The bytes string
     * @return The message identifier
     */
    function identifier(bytes29 _view) internal pure returns (uint8) {
        return uint8(_view.indexUint(0, 1));
    }

    /**
     * @notice Checks that view is a valid message length
     * @param _view The bytes string
     * @return TRUE if message is valid
     */
    function isValidDataRootLength(bytes29 _view) internal pure returns (bool) {
        uint256 _len = _view.len();
        return _len == IDENTIFIER_LEN + BLOCK_NUMBER_LEN + DATA_ROOT_LEN;
    }

    /**
     * @notice Returns the type of the message
     * @param _view The message
     * @return The type of the message
     */
    function messageType(bytes29 _view) internal pure returns (Types) {
        return Types(uint8(_view.typeOf()));
    }

    /**
     * @notice Checks that the message is of the specified type
     * @param _type the type to check for
     * @param _view The message
     * @return True if the message is of the specified type
     */
    function isType(bytes29 _view, Types _type) internal pure returns (bool) {
        return messageType(_view) == _type;
    }

    /**
     * @notice Checks that the message is of type DataRoot
     * @param _view The message
     * @return True if the message is of type DataRoot
     */
    function isDataRoot(bytes29 _view) internal pure returns (bool) {
        return isType(_view, Types.DataRoot);
    }

    /**
     * @notice Creates a serialized data root from components
     * @param _blockNumber The block number
     * @param _root The root
     * @return The formatted data root
     */
    function formatDataRoot(uint32 _blockNumber, bytes32 _root)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(uint8(Types.DataRoot), _blockNumber, _root);
    }

    /**
     * @notice Retrieves the block number from a message
     * @param _message The message
     * @return The block number
     */
    function blockNumber(bytes29 _message) internal pure returns (uint32) {
        return
            uint32(_message.indexUint(IDENTIFIER_LEN, uint8(BLOCK_NUMBER_LEN)));
    }

    /**
     * @notice Retrieves the data root from a message
     * @param _message The message
     * @return The data root
     */
    function dataRoot(bytes29 _message) internal pure returns (bytes32) {
        return
            _message.index(
                BLOCK_NUMBER_LEN + IDENTIFIER_LEN,
                uint8(DATA_ROOT_LEN)
            );
    }

    function isValidDataRoot(bytes29 _view) internal pure returns (bool) {
        return isType(_view, Types.DataRoot) && isValidDataRootLength(_view);
    }

    function getTypedView(bytes29 _view) internal pure returns (bytes29) {
        Types _type = Types(identifier(_view));
        return _view.castTo(uint40(_type));
    }
}
