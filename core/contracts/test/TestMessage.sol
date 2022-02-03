// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {Message} from "../../libs/Message.sol";

contract TestMessage {
    using Message for bytes29;
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    function body(bytes memory _message) external view returns (bytes memory) {
        return _message.ref(0).body().clone();
    }

    function origin(bytes memory _message) external pure returns (uint32) {
        return _message.ref(0).origin();
    }

    function sender(bytes memory _message) external pure returns (bytes32) {
        return _message.ref(0).sender();
    }

    function nonce(bytes memory _message) external pure returns (uint32) {
        return _message.ref(0).nonce();
    }

    function destination(bytes memory _message) external pure returns (uint32) {
        return _message.ref(0).destination();
    }

    function recipient(bytes memory _message) external pure returns (bytes32) {
        return _message.ref(0).recipient();
    }

    function recipientAddress(bytes memory _message)
        external
        pure
        returns (address)
    {
        return _message.ref(0).recipientAddress();
    }

    function leaf(bytes memory _message) external view returns (bytes32) {
        return _message.ref(0).leaf();
    }
}
