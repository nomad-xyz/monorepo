// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {Encoding} from "@nomad-xyz/contracts-bridge/contracts/Encoding.sol";

contract MerkleTest is Test {
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";

    using Encoding for uint256;

    function getProof(bytes memory message)
        public
        returns (
            bytes32,
            bytes32,
            uint256,
            bytes32[32] memory
        )
    {
        // Hash the message
        string memory hash = toHexString(keccak256(message));
        string[] memory input = new string[](7);
        input[0] = "yarn";
        input[1] = "gen-proof";
        input[2] = "-r";
        input[3] = "-m";
        input[4] = hash;
        input[5] = "-i";
        input[6] = "0";
        bytes memory result = vm.ffi(input);
        (
            bytes32 root,
            bytes32 leaf,
            uint256 index,
            bytes32[32] memory proof
        ) = abi.decode(result, (bytes32, bytes32, uint256, bytes32[32]));
        return (root, leaf, index, proof);
    }

    function toHexString(bytes32 input) private returns (string memory) {
        (uint256 a, uint256 b) = uint256(input).encodeHex();
        return string(abi.encodePacked("0x", a, b));
    }

    function toUint256(bytes memory _bytes)
        internal
        pure
        returns (uint256 value)
    {
        assembly {
            value := mload(add(_bytes, 0x20))
        }
    }
}
