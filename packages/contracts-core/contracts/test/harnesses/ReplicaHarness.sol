// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {Replica} from "../../Replica.sol";
import {Message} from "../../libs/Message.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

contract ReplicaHarness is Replica {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using Message for bytes29;

    constructor(uint32 _localDomain) Replica(_localDomain) {}

    function setCommittedRoot(bytes32 root) public {
        committedRoot = root;
        confirmAt[root] = 1;
    }

    function setMessageStatus(bytes memory message, bytes32 status) public {
        bytes29 m = message.ref(0);
        messages[m.keccak()] = status;
    }
}
