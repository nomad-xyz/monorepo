// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Home} from "../Home.sol";
import {NomadTest} from "./utils/NomadTest.sol";
import {NomadBaseHarness} from "./harnesses/NomadBaseHarness.sol";
import {console} from "forge-std/console.sol";

contract NomadBaseTest is NomadTest {
    NomadBaseHarness nbh;

    function setUp() public override {
        super.setUp();
        nbh = new NomadBaseHarness(domain);
        nbh.initialize(updater);
        vm.label(address(nbh), "Nomad Base Harness");
    }

    function testAcceptUpdaterSignature() public {
        bytes32 oldRoot = "old Root";
        bytes32 newRoot = "new Root";
        vm.prank(updater);
        bytes memory sig = signUpdate(updaterPK, oldRoot, newRoot);
        assert(nbh.isUpdaterSignature(oldRoot, newRoot, sig));
    }
}
