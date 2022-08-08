// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {IMessageRecipient} from "../../interfaces/IMessageRecipient.sol";

contract GoodXappSimple is IMessageRecipient {
    event MessageReceived(
        uint32 origin,
        uint32 nonce,
        bytes32 sender,
        bytes body
    );

    function handle(
        uint32 origin,
        uint32 nonce,
        bytes32 sender,
        bytes memory body
    ) external override {
        emit MessageReceived(origin, nonce, sender, body);
    }
}
