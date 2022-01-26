// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

interface IPreflight {
    function preflight(
        uint32 _origin,
        uint32 _nonce,
        bytes32 _sender,
        bytes memory _message
    ) external view returns (uint256);
}

interface IMessageRecipient {
    function handle(
        uint32 _origin,
        uint32 _nonce,
        bytes32 _sender,
        bytes memory _message
    ) external;
}
