// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import "../Home.sol";

contract TestHome is Home {
    using QueueLib for QueueLib.Queue;
    using MerkleLib for MerkleLib.Tree;

    constructor(uint32 _localDomain) Home(_localDomain) {} // solhint-disable-line no-empty-blocks

    function nextLeafIndex() external view returns (uint256) {
        return count();
    }

    function testHomeDomainHash() external view returns (bytes32) {
        return homeDomainHash();
    }

    function testDestinationAndNonce(uint32 _destination, uint32 _nonce)
        external
        pure
        returns (uint64)
    {
        return _destinationAndNonce(_destination, _nonce);
    }

    function setFailed() public {
        _setFailed();
    }
}
