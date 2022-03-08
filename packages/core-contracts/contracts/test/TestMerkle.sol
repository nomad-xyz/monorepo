// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import "../Merkle.sol";

contract TestMerkle is MerkleTreeManager {
    using MerkleLib for MerkleLib.Tree;

    // solhint-disable-next-line no-empty-blocks
    constructor() MerkleTreeManager() {}

    function insert(bytes32 _node) external {
        tree.insert(_node);
    }

    function branchRoot(
        bytes32 _leaf,
        bytes32[32] calldata _proof,
        uint256 _index
    ) external pure returns (bytes32 _node) {
        return MerkleLib.branchRoot(_leaf, _proof, _index);
    }
}
