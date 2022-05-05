// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Home} from "../Home.sol";
import {NomadTestWithUpdaterManager} from "./utils/NomadTest.sol";
import {IUpdaterManager} from "../interfaces/IUpdaterManager.sol";

contract HomeTest is NomadTestWithUpdaterManager {
    Home home;

    function setUp() public override {
        super.setUp();
        home = new Home(homeDomain);
        home.initialize(IUpdaterManager(address(updaterManager)));
    }

    function test_homeDomain() public {
        assertEq(
            keccak256(abi.encodePacked(homeDomain, "NOMAD")),
            home.homeDomainHash()
        );
    }

    function test_onlyUpdaterManagerSetUpdater() public {
        vm.prank(address(updaterManager));
        home.setUpdater(vm.addr(420));
    }

    event Dispatch(
        bytes32 indexed messageHash,
        uint256 indexed leafIndex,
        uint64 indexed destinationAndNonce,
        bytes32 committedRoot,
        bytes message
    );

    // TODO: Fuzzing test
//    function test_dispatchMessage() public {
//        uint32 destDomain = 420;
//        bytes32 destAddr = "0xFe8874778f946Ac2990A29eba3CFd50760593B2F";
//        bytes memory message = bytes("message");
//        vm.expectEmit(true, true, true, true);
//        emit Dispatch(
//        home.dispatch(destDomain, desAddr, message);
//
//    }

    function dispatchGetRoot(
        uint32 domain,
        bytes memory message,
        bytes32 recipient
    ) public returns (bytes32 sRoot) {
        home.dispatch(homeDomain, recipient, message);
        (, sRoot) = home.suggestUpdate();
    }
}
