// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {Message} from "@nomad-xyz/contracts-core/contracts/libs/Message.sol";

contract MockHome {
    uint32 public localDomain;
    uint256 counter;
    mapping(uint32 => uint32) public nonces;
    bytes32 public committedRoot;
    uint256 public constant MAX_MESSAGE_BODY_BYTES = 2 * 2**10;

    constructor(uint32 domain) {
        localDomain = domain;
    }

    event Dispatch(
        bytes32 indexed messageHash,
        uint256 indexed leafIndex,
        uint64 indexed destinationAndNonce,
        bytes32 committedRoot,
        bytes message
    );

    function dispatch(
        uint32 _destinationDomain,
        bytes32 _recipientAddress,
        bytes memory _messageBody
    ) external {
        require(_messageBody.length <= MAX_MESSAGE_BODY_BYTES, "msg too long");
        uint32 _nonce = nonces[_destinationDomain];
        nonces[_destinationDomain] = _nonce + 1;
        bytes memory _message = Message.formatMessage(
            localDomain,
            bytes32(uint256(uint160(msg.sender))),
            _nonce,
            _destinationDomain,
            _recipientAddress,
            _messageBody
        );
        bytes32 _messageHash = keccak256(_message);
        emit Dispatch(
            _messageHash,
            count() - 1,
            _destinationAndNonce(_destinationDomain, _nonce),
            committedRoot,
            _message
        );
    }

    function hack_expectDispatchEvent(
        uint32 _destinationDomain,
        bytes32 _recipientAddress,
        bytes memory _messageBody,
        address sender
    ) external {
        uint32 _nonce = nonces[_destinationDomain];
        bytes memory _message = Message.formatMessage(
            localDomain,
            bytes32(uint256(uint160(sender))),
            _nonce,
            _destinationDomain,
            _recipientAddress,
            _messageBody
        );
        bytes32 _messageHash = keccak256(_message);
        emit Dispatch(
            _messageHash,
            counter,
            _destinationAndNonce(_destinationDomain, _nonce),
            committedRoot,
            _message
        );
    }

    function count() public returns (uint256) {
        counter = counter + 1;
        return counter;
    }

    function _destinationAndNonce(uint32 _destination, uint32 _nonce)
        internal
        pure
        returns (uint64)
    {
        return (uint64(_destination) << 32) | _nonce;
    }
}
