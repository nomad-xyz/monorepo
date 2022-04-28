// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Home} from "../Home.sol";
import {NomadTestWithUpdaterManager} from "./utils/NomadTest.sol";
import {IUpdaterManager} from "../interfaces/IUpdaterManager.sol";

contract HomeTest is NomadTestWithUpdaterManager {
    Home home;

    function setUp() public override {
        super.setUp();
        home = new Home(domain);
        home.initialize(IUpdaterManager(address(updaterManager)));
    }

    function test_homeDomain() public {
        assertEq(
            keccak256(abi.encodePacked(domain, "NOMAD")),
            home.homeDomainHash()
        );
    }

    function test_onlyUpdaterManagerSetUpdater() public {
        vm.prank(address(updaterManager));
        home.setUpdater(vm.addr(420));
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
