// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Encoding} from "../Encoding.sol";

contract TestEncoding {
    function assertEq(
        bytes memory actual,
        bytes memory expected,
        string memory message
    ) internal pure {
        require(
            keccak256(actual) == keccak256(expected),
            string(
                abi.encodePacked(
                    message,
                    " expected ",
                    expected,
                    " got ",
                    actual
                )
            )
        );
    }

    function test() public pure {
        assertEq(
            abi.encodePacked(Encoding.decimalUint32(1234)),
            bytes("0000001234"),
            "encode 1234"
        );

        uint256 a;
        uint256 b;
        (a, b) = Encoding.encodeHex(uint256(-1));

        assertEq(
            abi.encodePacked(a, b),
            bytes(
                "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            ),
            "encode uintmax"
        );
    }
}
