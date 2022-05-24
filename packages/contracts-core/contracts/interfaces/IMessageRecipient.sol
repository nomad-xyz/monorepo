// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// Interface an app MUST implement
// to handle x-chain messages sent via Nomad
interface IMessageRecipient {
    function handle(
        uint32 _origin,
        uint32 _nonce,
        bytes32 _sender,
        bytes memory _message
    ) external;
}

// Interface an app ~can~ implement
// to get finer control over Replica behavior:
// - block message processing if Fraud has been proven
// - specify gas requested to process a message
// TODO: naming?!?!?!
interface IPreflight {
    function preflight(
        uint32 _origin,
        uint32 _nonce,
        bytes32 _sender,
        bytes memory _message
    ) external view returns (bool _canProcess, uint256 _processGas);
}
