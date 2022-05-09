// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Replica} from "../../Replica.sol";

contract ReplicaHarness is Replica {

    constructor(
        uint32 _localDomain,
        uint256 _processGas,
        uint256 _reserveGas) Replica(_localDomain, _processGas, _reserveGas){}

    function setCommittedRoot(bytes32 root) public {
        committedRoot = root;
        confirmAt[root] = 1;
    }
}
