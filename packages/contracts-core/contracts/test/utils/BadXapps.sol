// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {IMessageRecipient} from "../../interfaces/IMessageRecipient.sol";

// We test various different malformed implementations of the same function.
// In order to test different implementations of the same function, with the same signature,
// we need to define the function in many different contracts.

contract BadXappAssemblyRevert is IMessageRecipient {
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

contract BadXappAssemblyReturnZero is IMessageRecipient {
    function handle(
        uint32,
        uint32,
        bytes32,
        bytes memory
    ) external pure override {
        assembly {
            return(0, 0)
        }
    }
}

contract BadXappRevertData is IMessageRecipient {
    function handle(
        uint32,
        uint32,
        bytes32,
        bytes memory
    ) external pure override {
        assembly {
            mstore(0, 0xabcdef)
            revert(0, 32)
        }
    }
}

contract BadXappRevertRequireString is IMessageRecipient {
    function handle(
        uint32,
        uint32,
        bytes32,
        bytes memory
    ) external pure override {
        require(false, "no can do");
    }
}

contract BadXappRevertRequire is IMessageRecipient {
    function handle(
        uint32,
        uint32,
        bytes32,
        bytes memory
    ) external pure override {
        require(false);
    }
}

contract BadXappNoHandler {
    uint256 fourtwenty = 420;

    function bonk() external view returns (uint256) {
        return fourtwenty;
    }
}
