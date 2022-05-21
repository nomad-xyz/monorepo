// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

interface IMessageRecipient {
    function handle(
        uint32 _origin,
        uint32 _nonce,
        bytes32 _sender,
        bytes memory _message
    ) external;
}
