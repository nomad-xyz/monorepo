// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "../libs/Merkle.sol";

contract MerkleLibTest is Test {
    using MerkleLib for MerkleLib.Tree;
    MerkleLib.Tree tree;

    bytes32 firstItem;
    bytes32 secondItem;

    function setUp() public {
        firstItem = "Elves";
        secondItem = "Men";
        tree.insert(firstItem);
        tree.insert(secondItem);
    }

    function test_depthIs32() public {
        assertEq(MerkleLib.TREE_DEPTH, 32);
    }

    function test_maxLeaves() public {
        assertEq(MerkleLib.MAX_LEAVES, 2**32 - 1);
    }

    function test_insert() public {
        assertEq(tree.count, 2);
    }
}
