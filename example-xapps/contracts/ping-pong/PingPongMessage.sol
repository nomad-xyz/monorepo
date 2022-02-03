// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import "@summa-tx/memview-sol/contracts/TypedMemView.sol";

library PingPongMessage {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    /// @dev Each message is encoded as a 1-byte type distinguisher, a 4-byte
    /// match id, and a 32-byte volley counter. The messages are therefore all
    /// 37 bytes
    enum Types {
        Invalid, // 0
        Ping, // 1
        Pong // 2
    }

    // ============ Formatters ============

    /**
     * @notice Format a Ping volley
     * @param _count The number of volleys in this match
     * @return The encoded bytes message
     */
    function formatPing(uint32 _match, uint256 _count)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(uint8(Types.Ping), _match, _count);
    }

    /**
     * @notice Format a Pong volley
     * @param _count The number of volleys in this match
     * @return The encoded bytes message
     */
    function formatPong(uint32 _match, uint256 _count)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(uint8(Types.Pong), _match, _count);
    }

    // ============ Identifiers ============

    /**
     * @notice Get the type that the TypedMemView is cast to
     * @param _view The message
     * @return _type The type of the message (either Ping or Pong)
     */
    function messageType(bytes29 _view) internal pure returns (Types _type) {
        _type = Types(uint8(_view.typeOf()));
    }

    /**
     * @notice Determine whether the message contains a Ping volley
     * @param _view The message
     * @return True if the volley is Ping
     */
    function isPing(bytes29 _view) internal pure returns (bool) {
        return messageType(_view) == Types.Ping;
    }

    /**
     * @notice Determine whether the message contains a Pong volley
     * @param _view The message
     * @return True if the volley is Pong
     */
    function isPong(bytes29 _view) internal pure returns (bool) {
        return messageType(_view) == Types.Pong;
    }

    // ============ Getters ============

    /**
     * @notice Parse the match ID sent within a Ping or Pong message
     * @dev The number is encoded as a uint32 at index 1
     * @param _view The message
     * @return The match id encoded in the message
     */
    function matchId(bytes29 _view) internal pure returns (uint32) {
        // At index 1, read 4 bytes as a uint, and cast to a uint32
        return uint32(_view.indexUint(1, 4));
    }

    /**
     * @notice Parse the volley count sent within a Ping or Pong message
     * @dev The number is encoded as a uint256 at index 1
     * @param _view The message
     * @return The count encoded in the message
     */
    function count(bytes29 _view) internal pure returns (uint256) {
        // At index 1, read 32 bytes as a uint
        return _view.indexUint(1, 32);
    }
}
