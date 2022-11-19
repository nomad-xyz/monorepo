// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

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
        nbh = new NomadBaseHarness(homeDomain);
        vm.expectEmit(false, false, false, true);
        emit NewUpdater(address(0), updaterAddr);
        nbh.initialize(updaterAddr);
        vm.label(address(nbh), "Nomad Base Harness");
    }

    function test_failInitializeTwice() public {
        vm.expectRevert(
            bytes("Initializable: contract is already initialized")
        );
        nbh.initialize(updaterAddr);
    }

    function test_ownerIsContractCreator() public {
        assertEq(nbh.owner(), address(this));
    }

    function test_stateIsActiveAfterInit() public {
        assertEq(uint256(nbh.state()), 1);
    }

    function test_acceptUpdaterSignature() public {
        bytes memory sig = signHomeUpdate(updaterPK, oldRoot, newRoot);
        assertTrue(nbh.isUpdaterSignature(oldRoot, newRoot, sig));
    }

    function test_rejectNonUpdaterSignature() public {
        bytes memory sig = signHomeUpdate(fakeUpdaterPK, oldRoot, newRoot);
        assertFalse(nbh.isUpdaterSignature(oldRoot, newRoot, sig));
    }

    function test_homeDomainHash() public {
        assertEq(
            nbh.homeDomainHash(),
            keccak256(abi.encodePacked(homeDomain, "NOMAD"))
        );
    }
}
