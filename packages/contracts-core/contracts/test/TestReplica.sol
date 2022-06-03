// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import "../Replica.sol";

contract TestReplica is Replica {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using Message for bytes29;

    constructor(
        uint32 _localDomain,
        uint256,
        uint256
    ) Replica(_localDomain, 850_000, 15_000) {} // solhint-disable-line no-empty-blocks

    function setFailed() public {
        _setFailed();
    }

    function setRemoteDomain(uint32 _remoteDomain) external {
        remoteDomain = _remoteDomain;
    }

    function setMessagePending(bytes memory _message) external {
        bytes29 _m = _message.ref(0);
        messages[_m.keccak()] = MessageStatus.Proven;
    }

    function setCommittedRoot(bytes32 _newRoot) external {
        committedRoot = _newRoot;
        confirmAt[_newRoot] = 1;
    }

    function timestamp() external view returns (uint256) {
        return block.timestamp;
    }

    function testHomeDomainHash() external view returns (bytes32) {
        return homeDomainHash();
    }

    function testBranchRoot(
        bytes32 leaf,
        bytes32[32] calldata proof,
        uint256 index
    ) external pure returns (bytes32) {
        return MerkleLib.branchRoot(leaf, proof, index);
    }

    function testProcess(bytes memory _message)
        external
        returns (bool _success)
    {
        (_success) = process(_message);
    }

    function getRevertMsg(bytes memory _res)
        internal
        view
        returns (string memory)
    {
        bytes29 _view = _res.ref(0);

        // If the _res length is less than 68, then the transaction failed
        // silently (without a revert message)
        if (_view.len() < 68) return "Transaction reverted silently";

        // Remove the selector which is the first 4 bytes
        bytes memory _revertData = _view.slice(4, _res.length - 4, 0).clone();

        // All that remains is the revert string
        return abi.decode(_revertData, (string));
    }
}
