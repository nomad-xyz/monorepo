// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

contract RevertingToHook {
    uint256 public test;

    function onReceive(
        uint32 origin,
        bytes32,
        uint32,
        bytes32,
        address,
        uint256,
        bytes memory
    ) external {
        if (origin > 500) {
            revert();
        } else if (origin > 10) {
            revert("nope!");
        } else {
            test = 123;
        }
    }
}
