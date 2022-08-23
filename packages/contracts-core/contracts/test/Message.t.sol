// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {Message} from "../libs/Message.sol";
import "forge-std/Test.sol";

import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/libs/TypeCasts.sol";

contract MessageTest is Test {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using Message for bytes29;

    // Message components
    uint32 originDomain;
    bytes32 sender;
    uint32 nonce;
    uint32 destinationDomain;
    bytes32 recipient;
    bytes body;

    bytes message;
    bytes32 messageHash;
    bytes29 messageView;

    function setUp() public {
        originDomain = 1000;
        sender = TypeCasts.addressToBytes32(vm.addr(1));
        nonce = 24;
        destinationDomain = 12340;
        recipient = TypeCasts.addressToBytes32(vm.addr(2));
        body = hex"E93F";
        message = abi.encodePacked(
            originDomain,
            sender,
            nonce,
            destinationDomain,
            recipient,
            body
        );
        messageHash = keccak256(message);
    }

    function test_prefixIs76() public {
        assertEq(Message.PREFIX_LENGTH, 76);
    }

    function test_formatMessage() public {
        assertEq(
            Message.formatMessage(
                originDomain,
                sender,
                nonce,
                destinationDomain,
                recipient,
                body
            ),
            message
        );
    }

    function test_messageHash() public {
        assertEq(
            Message.messageHash(
                originDomain,
                sender,
                nonce,
                destinationDomain,
                recipient,
                body
            ),
            messageHash
        );
    }

    function test_origin() public {
        messageView = message.ref(0);
        assertEq(uint256(Message.origin(messageView)), uint256(originDomain));
    }

    function test_sender() public {
        messageView = message.ref(0);
        assertEq(Message.sender(messageView), sender);
    }

    function test_nonce() public {
        messageView = message.ref(0);
        assertEq(uint256(Message.nonce(messageView)), uint256(nonce));
    }

    function test_destination() public {
        messageView = message.ref(0);
        assertEq(uint256(Message.nonce(messageView)), uint256(nonce));
    }

    function test_recipient() public {
        messageView = message.ref(0);
        assertEq(Message.recipient(messageView), recipient);
    }

    function test_body() public {
        messageView = message.ref(0);
        assertEq(Message.body(messageView).keccak(), body.ref(0).keccak());
    }

    function test_leaf() public {
        messageView = message.ref(0);
        assertEq(messageView.leaf(), messageHash);
    }
}
