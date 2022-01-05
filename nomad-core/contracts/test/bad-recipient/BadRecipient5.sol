// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {IMessageRecipient} from "../../../interfaces/IMessageRecipient.sol";

contract BadRecipient5 is IMessageRecipient {
    function handle(
        uint32,
        uint32,
        bytes32,
        bytes memory
    ) external pure override {
        require(false, "no can do");
    }
}
