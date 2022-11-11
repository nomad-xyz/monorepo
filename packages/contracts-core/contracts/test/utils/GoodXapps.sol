// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {IMessageRecipient} from "../../interfaces/IMessageRecipient.sol";

// We test various different malformed implementations of the same function.
// In order to test different implementations of the same function, with the same signature,
// we need to define the function in many different contracts.

contract GoodXappSimple is IMessageRecipient {
    event Handler(string);
    uint256 public number;

    function handle(
        uint32,
        uint32,
        bytes32,
        bytes memory
    ) external override {
        emit Handler("Handled");
    }

    function setNumber(uint256 _number) external {
        number = _number;
    }

    function itReverts() public pure {
        revert("i am revertiiiiing");
    }
}
