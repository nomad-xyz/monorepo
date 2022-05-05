// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Replica} from "../Replica.sol";
import {NomadTest} from "./utils/NomadTest.sol";

contract ReplicaTest is NomadTest {

    Replica replica;

    bytes32 committedRoot;
    uint256 optimisticSeconds;

    function setUp() public override {
        super.setUp();
        uint256 processGas = 850_000;
        uint256 reserveGas = 15_000;

        replica  = new Replica(homeDomain, processGas, reserveGas);

        assertEq(replica.PROCESS_GAS(), processGas);
        assertEq(replica.RESERVE_GAS(), reserveGas);

        initializeReplica();

    }

    function initializeReplica() public {

        optimisticSeconds = 10;
        committedRoot = "committed root";

        replica.initialize(remoteDomain, updater, committedRoot, optimisticSeconds);
        assertEq(uint256(replica.remoteDomain()), uint256(remoteDomain));
        assertEq(replica.committedRoot(), committedRoot);
        assertEq(replica.optimisticSeconds(), optimisticSeconds);
        assertEq(replica.confirmAt(committedRoot), 1);
    }

    event Update(
        uint32 indexed homeDomain,
        bytes32 indexed oldRoot,
        bytes32 indexed newRoot,
        bytes signature
    );

    function test_acceptReplicaUpdate() public {

        bytes32 oldRoot = committedRoot;
        bytes32 newRoot = "newRoot";
        bytes memory sig = signRemoteUpdate(updaterPK, oldRoot, newRoot);
        vm.expectEmit(true, true, true, true);
        emit Update(remoteDomain, oldRoot, newRoot, sig);
        replica.update(oldRoot, newRoot, sig);

        assertEq(replica.confirmAt(newRoot), block.timestamp + optimisticSeconds);
        assertEq(replica.committedRoot(), newRoot);
    }

    function test_rejectReplicaNonCurrentUpdate() public {
        bytes32 oldRoot = "non commited root";
        bytes32 newRoot = "newRoot";
        bytes memory sig = signRemoteUpdate(updaterPK, oldRoot, newRoot);
        vm.expectRevert("not current update");
        replica.update(oldRoot, newRoot, sig);
    }

    function test_rejectReplicaUpdateInvalidSig() public {
        bytes32 oldRoot = committedRoot;
        bytes32 newRoot = "newRoot";
        bytes memory sig = signRemoteUpdate(fakeUpdaterPK, oldRoot, newRoot);
        vm.expectRevert("!updater sig");
        replica.update(oldRoot, newRoot, sig);
    }
}
