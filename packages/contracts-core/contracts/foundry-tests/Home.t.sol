// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Home} from "../Home.sol";
import {NomadTest} from "./utils/NomadTest.sol";

contract HomeTest is NomadTest {
    Home home;

    function setUp() public override {
        super.setUp();
    }

    function dispatchGetRoot(
        uint32 domain,
        bytes memory message,
        bytes32 recipient
    ) public returns (bytes32 sRoot) {
        home.dispatch(domain, recipient, message);
        (, sRoot) = home.suggestUpdate();
    }
}
