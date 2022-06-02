// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MerkleTest is Test {
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";

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
        bytes32 hash = keccak256(message);
        string[] memory input = new string[](7);
        input[0] = "yarn";
        input[1] = "gen-proof";
        input[2] = "-r";
        input[3] = "-m";
        input[4] = toHexString(uint256(keccak256(message)));
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

    // Pulled from String.sol from OpenZeppelin
    // source: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.6.0/contracts/utils/Strings.sol
    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    function toHexString(uint256 value, uint256 length)
        internal
        pure
        returns (string memory)
    {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
}
