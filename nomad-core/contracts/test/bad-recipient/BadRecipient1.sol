// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {IMessageRecipient} from "../../../interfaces/IMessageRecipient.sol";

contract BadRecipient1 is IMessageRecipient {
    function handle(
        uint32,
        uint32,
        bytes32,
        bytes memory
    ) external pure override {
        assembly {
            revert(0, 0)
        }
    }
}
