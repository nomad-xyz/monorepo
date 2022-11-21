// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {Test} from "forge-std/Test.sol";
import {Encoding} from "../Encoding.sol";

contract EncodingTest is Test {
    using Encoding for uint32;
    using Encoding for uint256;

    function setUp() public {}

    function testFuzz_decimalUint32(uint32 input) public {
        vm.assume(input != 0);
        uint256 digits;
        uint32 number = input;
        while (number != 0) {
            number /= 10;
            digits++;
        }
        string memory str = vm.toString(uint256(input));
        // Add as many zeroes as needed to reach 10 digits in total
        // 01 ---> 00000000 + 01
        for (uint256 i; i < 10 - digits; i++) {
            str = string(abi.encodePacked("0", str));
        }
        assertEq(abi.encodePacked(input.decimalUint32()), bytes(str));
    }

    function testFuzz_encodeHex(bytes32 input) public {
        (uint256 a, uint256 b) = uint256(input).encodeHex();
        string memory output = string(abi.encodePacked("0x", a, b));
        assertEq(output, vm.toString(input));
    }
}
