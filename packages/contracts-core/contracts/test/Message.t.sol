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

    function setUp() public {}

    function test_prefixIs76() public {
        assertEq(Message.PREFIX_LENGTH, 76);
    }

    function test_formatMessage() public {
        uint32 originDomain = 1000;
        bytes32 sender = TypeCasts.addressToBytes32(vm.addr(1));
        uint32 nonce = 24;
        uint32 destinationDomain = 12340;
        bytes32 recipient = TypeCasts.addressToBytes32(vm.addr(2));
        bytes memory body = hex"E93F";
        assertEq(
            Message.formatMessage(
                originDomain,
                sender,
                nonce,
                destinationDomain,
                recipient,
                body
            ),
            abi.encodePacked(
                originDomain,
                sender,
                nonce,
                destinationDomain,
                recipient,
                body
            )
        );
    }
}
