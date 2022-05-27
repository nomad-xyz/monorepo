// SPDX-License-Identifier: MIT

pragma solidity >=0.6.11;

import "./MysteryMath.sol";

contract MysteryMathV1 is MysteryMath {
    uint32 public immutable version;

    constructor() {
        version = 1;
    }

    function doMath(uint256 a, uint256 b)
        external
        pure
        override
        returns (uint256 _result)
    {
        _result = a + b;
    }
}
