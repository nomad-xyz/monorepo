// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "../libs/Merkle.sol";
import {MerkleTest} from "./utils/MerkleTest.sol";

contract MerkleLibTest is Test {
    using MerkleLib for MerkleLib.Tree;
    MerkleLib.Tree tree;
    MerkleLib.Tree otherTree;
    MerkleTest merkleTest;

    bytes32 firstItem;
    bytes32 secondItem;
    bytes32 thirdItem;

    function setUp() public {
        firstItem = "Elves";
        secondItem = "Men";
        thirdItem = "Dwarves";
        assertEq(tree.count, 0);
        tree.insert(firstItem);
        tree.insert(secondItem);
        merkleTest = new MerkleTest();
    }

    function test_depthIs32() public {
        assertEq(MerkleLib.TREE_DEPTH, 32);
    }

    function test_maxLeaves() public {
        assertEq(MerkleLib.MAX_LEAVES, 2**32 - 1);
    }

    function test_insertFailLeavesCount() public {
        tree.count = MerkleLib.MAX_LEAVES;
        vm.expectRevert("merkle tree full");
        tree.insert(firstItem);
    }

    function test_insert() public {
        // state of the tree before inserting a third element
        assertEq(tree.branch[0], firstItem);
        assertEq(
            tree.branch[1],
            keccak256(abi.encodePacked(tree.branch[0], secondItem))
        );
        assertEq(tree.count, 2);
        tree.insert(thirdItem);
        // state of the tree after inserting a third element
        assertEq(tree.count, 3);
        assertEq(
            tree.branch[0],
            hex"4477617276657300000000000000000000000000000000000000000000000000"
        );
        assertEq(tree.branch[0], thirdItem);
        assertEq(
            tree.branch[1],
            hex"ef9e5bd449a24d67e3b7bfb742ee07d151d2999f134b78cb1f6b16f5c963be76"
        );
        for (uint256 i = 2; i < 32; i++) {
            assertEq(
                tree.branch[i],
                hex"0000000000000000000000000000000000000000000000000000000000000000"
            );
        }
    }

    function test_rootDifferential() public {
        bytes memory item = "hey";
        otherTree.insert(keccak256(item));
        (bytes32 root, , , bytes32[32] memory proof) = merkleTest.getProof(
            item
        );
        assertEq(otherTree.root(), root);
    }

    function test_branchRootDifferentialFuzzed(bytes memory item) public {
        (
            bytes32 root,
            bytes32 leaf,
            uint256 index,
            bytes32[32] memory proof
        ) = merkleTest.getProof(item);
        bytes32 calcRoot = MerkleLib.branchRoot(keccak256(item), proof, index);
        assertEq(calcRoot, root);
    }

    function test_root() public {
        // root of the tree with a state as defined in the setUp() function
        assertEq(
            tree.root(),
            bytes32(
                hex"a1abd8796700ac5e2bb7be26424ba7c2a8181d81f54e8c5ac51afae62d10b5e9"
            )
        );
    }

    function test_zeroHashes() public {
        bytes32[32] memory data = MerkleLib.zeroHashes();
        assertEq(
            data[0],
            hex"0000000000000000000000000000000000000000000000000000000000000000"
        );
        assertEq(
            data[1],
            hex"ad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5"
        );
        assertEq(
            data[2],
            hex"b4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30"
        );
        assertEq(
            data[3],
            hex"21ddb9a356815c3fac1026b6dec5df3124afbadb485c9ba5a3e3398a04b7ba85"
        );
        assertEq(
            data[4],
            hex"e58769b32a1beaf1ea27375a44095a0d1fb664ce2dd358e7fcbfb78c26a19344"
        );
        assertEq(
            data[5],
            hex"0eb01ebfc9ed27500cd4dfc979272d1f0913cc9f66540d7e8005811109e1cf2d"
        );
        assertEq(
            data[6],
            hex"887c22bd8750d34016ac3c66b5ff102dacdd73f6b014e710b51e8022af9a1968"
        );
        assertEq(
            data[7],
            hex"ffd70157e48063fc33c97a050f7f640233bf646cc98d9524c6b92bcf3ab56f83"
        );
        assertEq(
            data[8],
            hex"9867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756af"
        );
        assertEq(
            data[9],
            hex"cefad4e508c098b9a7e1d8feb19955fb02ba9675585078710969d3440f5054e0"
        );
        assertEq(
            data[10],
            hex"f9dc3e7fe016e050eff260334f18a5d4fe391d82092319f5964f2e2eb7c1c3a5"
        );
        assertEq(
            data[11],
            hex"f8b13a49e282f609c317a833fb8d976d11517c571d1221a265d25af778ecf892"
        );
        assertEq(
            data[12],
            hex"3490c6ceeb450aecdc82e28293031d10c7d73bf85e57bf041a97360aa2c5d99c"
        );
        assertEq(
            data[13],
            hex"c1df82d9c4b87413eae2ef048f94b4d3554cea73d92b0f7af96e0271c691e2bb"
        );
        assertEq(
            data[14],
            hex"5c67add7c6caf302256adedf7ab114da0acfe870d449a3a489f781d659e8becc"
        );
        assertEq(
            data[15],
            hex"da7bce9f4e8618b6bd2f4132ce798cdc7a60e7e1460a7299e3c6342a579626d2"
        );
        assertEq(
            data[16],
            hex"2733e50f526ec2fa19a22b31e8ed50f23cd1fdf94c9154ed3a7609a2f1ff981f"
        );
        assertEq(
            data[17],
            hex"e1d3b5c807b281e4683cc6d6315cf95b9ade8641defcb32372f1c126e398ef7a"
        );
        assertEq(
            data[18],
            hex"5a2dce0a8a7f68bb74560f8f71837c2c2ebbcbf7fffb42ae1896f13f7c7479a0"
        );
        assertEq(
            data[19],
            hex"b46a28b6f55540f89444f63de0378e3d121be09e06cc9ded1c20e65876d36aa0"
        );
        assertEq(
            data[20],
            hex"c65e9645644786b620e2dd2ad648ddfcbf4a7e5b1a3a4ecfe7f64667a3f0b7e2"
        );
        assertEq(
            data[21],
            hex"f4418588ed35a2458cffeb39b93d26f18d2ab13bdce6aee58e7b99359ec2dfd9"
        );
        assertEq(
            data[22],
            hex"5a9c16dc00d6ef18b7933a6f8dc65ccb55667138776f7dea101070dc8796e377"
        );
        assertEq(
            data[23],
            hex"4df84f40ae0c8229d0d6069e5c8f39a7c299677a09d367fc7b05e3bc380ee652"
        );
        assertEq(
            data[24],
            hex"cdc72595f74c7b1043d0e1ffbab734648c838dfb0527d971b602bc216c9619ef"
        );
        assertEq(
            data[25],
            hex"0abf5ac974a1ed57f4050aa510dd9c74f508277b39d7973bb2dfccc5eeb0618d"
        );
        assertEq(
            data[26],
            hex"b8cd74046ff337f0a7bf2c8e03e10f642c1886798d71806ab1e888d9e5ee87d0"
        );
        assertEq(
            data[27],
            hex"838c5655cb21c6cb83313b5a631175dff4963772cce9108188b34ac87c81c41e"
        );
        assertEq(
            data[28],
            hex"662ee4dd2dd7b2bc707961b1e646c4047669dcb6584f0d8d770daf5d7e7deb2e"
        );
        assertEq(
            data[29],
            hex"388ab20e2573d171a88108e79d820e98f26c0b84aa8b2f4aa4968dbb818ea322"
        );
        assertEq(
            data[30],
            hex"93237c50ba75ee485f4c22adf2f741400bdf8d6a9cc7df7ecae576221665d735"
        );
        assertEq(
            data[31],
            hex"8448818bb4ae4562849e949e17ac16e0be16688e156b5cf15e098c627c0056a9"
        );
    }
}
