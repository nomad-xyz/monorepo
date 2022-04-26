// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Home} from "../Home.sol";
import {NomadTest} from "./utils/NomadTest.sol";
import {NomadBaseHarness} from "./harnesses/NomadBaseHarness.sol";
import {console} from "forge-std/console.sol";

contract NomadBaseTest is NomadTest {
    NomadBaseHarness nbh;

    bytes32 oldRoot = "old Root";
    bytes32 newRoot = "new Root";

    function setUp() public override {
        super.setUp();
        nbh = new NomadBaseHarness(domain);
        nbh.initialize(updater);
        vm.label(address(nbh), "Nomad Base Harness");
    }

    function test_acceptUpdaterSignature() public {
        vm.prank(updater);
        bytes memory sig = signUpdate(updaterPK, oldRoot, newRoot);
        assert(nbh.isUpdaterSignature(oldRoot, newRoot, sig));
    }

    function test_rejectNonUpdaterSignature() public {
        vm.prank(fakeUpdater);
        bytes memory sig = signUpdate(fakeUpdaterPK, oldRoot, newRoot);
        assert(nbh.isUpdaterSignature(oldRoot, newRoot, sig) == false);
    }

    event DoubleUpdate(
        bytes32 oldRoot,
        bytes32[2] newRoot,
        bytes signature,
        bytes signature2
    );

    function test_failOnDoubleUpdateProof() public {
        bytes32 newRoot2 = "new Root2";
        bytes memory sig = signUpdate(updaterPK, oldRoot, newRoot);
        bytes memory sig2 = signUpdate(updaterPK, oldRoot, newRoot2);
        bytes32[2] memory roots;
        roots[0] = newRoot;
        roots[1] = newRoot2;
        // We don't have any indexed fields, so we set all index bools to false
        // We want to check the event's data (unindexed fields), so we set the last arg to true
        // We emit an event to tell Forge what we expect to be emitted
        // We assert the enum with a number because internall enums are translated to numbers
        // based on the order which they are defined. Failed is the third type of the enum, thus 2.
        vm.expectEmit(false, false, false, true);
        emit DoubleUpdate(oldRoot, roots, sig, sig2);
        nbh.doubleUpdate(oldRoot, roots, sig, sig2);
        assertEq(uint256(nbh.state()), 2);
    }

    function test_notFailOnInvalidDoubleUpdateProof() public {
        bytes32 newRoot2 = newRoot;
        bytes memory sig = signUpdate(updaterPK, oldRoot, newRoot);
        bytes memory sig2 = signUpdate(updaterPK, oldRoot, newRoot2);
        bytes32[2] memory roots;
        roots[0] = newRoot;
        roots[1] = newRoot2;
        nbh.doubleUpdate(oldRoot, roots, sig, sig2);
        assertEq(uint256(nbh.state()), 1);
    }
}
