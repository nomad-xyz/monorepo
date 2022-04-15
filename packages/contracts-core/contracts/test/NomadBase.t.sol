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
        vm.label(address(nbh), "Nomad Base Harness");
    }

    function test_acceptUpdaterSignature() public {
        bytes32 oldRoot = "old Root";
        bytes32 newRoot = "new Root";
        console.log(unicode"oldRoot⇲");
        console.logBytes32(oldRoot);
        bytes memory sig = signUpdate(updaterPK, oldRoot, newRoot);
        assert(nbh.isUpdaterSignature(oldRoot, newRoot, sig));
    }
}
