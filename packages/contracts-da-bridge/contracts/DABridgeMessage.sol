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
        DataRootBatch // 1
    }

    // ============ Constants ============

    uint256 private constant IDENTIFIER_LEN = 1;
    uint256 private constant COUNT_LEN = 2;
    uint256 private constant BLOCK_NUMBER_LEN = 4;
    uint256 private constant DATA_ROOT_LEN = 32;

    // ============ Structs ============

    struct DataRootBatchItem {
        bytes32 dataRoot;
        uint32 blockNumber;
    }

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
    function isValidDataRootBatchLength(bytes29 _view)
        internal
        pure
        returns (bool)
    {
        uint256 _len = _view.len();
        uint16 dataCount = count(_view);
        require(dataCount > 0, "!valid message");
        uint256 expectedLen = IDENTIFIER_LEN +
            COUNT_LEN +
            dataCount *
            (BLOCK_NUMBER_LEN + DATA_ROOT_LEN);
        return _len == expectedLen;
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
     * @notice Checks that the message is of type DataRootBatch
     * @param _view The message
     * @return True if the message is of type DataRootBatch
     */
    function isDataRootBatch(bytes29 _view) internal pure returns (bool) {
        return isType(_view, Types.DataRootBatch);
    }

    /**
     * @notice Creates a serialized data root from components
     * @param data block number + root array
     * @return result The formatted data root
     */
    function formatDataRootBatch(DataRootBatchItem[] memory data)
        internal
        pure
        returns (bytes memory result)
    {
        result = abi.encodePacked(
            uint8(Types.DataRootBatch),
            uint16(data.length)
        );
        for (uint256 i = 0; i < data.length; i++) {
            result = abi.encodePacked(
                result,
                data[i].blockNumber,
                data[i].dataRoot
            );
        }
    }

    /**
     * @notice Retrieves the number of data roots from a message
     * @param _view The message
     * @return The amount of data roots
     */
    function count(bytes29 _view) internal pure returns (uint16) {
        return uint16(_view.indexUint(IDENTIFIER_LEN, uint8(COUNT_LEN)));
    }

    function dataRootBatch(bytes29 _view)
        internal
        pure
        returns (DataRootBatchItem[] memory)
    {
        uint16 _count = count(_view);
        DataRootBatchItem[] memory _dataRoots = new DataRootBatchItem[](_count);
        uint256 _offset = IDENTIFIER_LEN + COUNT_LEN;
        for (uint256 i = 0; i < _count; i++) {
            _dataRoots[i] = DataRootBatchItem({
                blockNumber: uint32(
                    _view.indexUint(_offset, uint8(BLOCK_NUMBER_LEN))
                ),
                dataRoot: bytes32(
                    _view.indexUint(
                        _offset + BLOCK_NUMBER_LEN,
                        uint8(DATA_ROOT_LEN)
                    )
                )
            });
            _offset += BLOCK_NUMBER_LEN + DATA_ROOT_LEN;
        }
        return _dataRoots;
    }

    function isValidDataRootBatch(bytes29 _view) internal pure returns (bool) {
        return
            isType(_view, Types.DataRootBatch) &&
            isValidDataRootBatchLength(_view);
    }

    function getTypedView(bytes29 _view) internal pure returns (bytes29) {
        Types _type = Types(identifier(_view));
        return _view.castTo(uint40(_type));
    }
}
