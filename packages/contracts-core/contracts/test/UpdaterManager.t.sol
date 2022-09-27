// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import {UpdaterManager} from "../UpdaterManager.sol";
import {TypeCasts} from "../libs/TypeCasts.sol";
import {Home} from "../Home.sol";

contract UpdaterManagerTest is Test {
    UpdaterManager updaterManager;

    address updater;

    Home home;

    uint32 localDomain;

    event FakeSlashed(address reporter);

    function setUp() public {
        updater = address(0xBEEF);
        updaterManager = new UpdaterManager(updater);
        localDomain = 30;
        home = new Home(localDomain);
        home.initialize(updaterManager);
    }

    function test_constructor() public {
        assertEq(updaterManager.updater(), updater);
    }

    event NewHome(address homeAddress);

    function test_setHome() public {
        // any address that is a contract
        address homeAddress = address(this);
        vm.expectEmit(false, false, false, true);
        emit NewHome(homeAddress);
        updaterManager.setHome(homeAddress);
        address storedAddress = TypeCasts.bytes32ToAddress(
            vm.load(address(updaterManager), bytes32(0))
        );
        assertEq(storedAddress, homeAddress);
    }

    function test_setHomeOnlyContract() public {
        address homeAddress = address(0xBEEF);
        vm.expectRevert("!contract home");
        updaterManager.setHome(homeAddress);
    }

    function test_setHomeOnlyOwnerFuzzed(address user) public {
        vm.assume(user != address(this));
        address homeAddress = address(this);
        updaterManager.setHome(homeAddress);
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        updaterManager.setHome(homeAddress);
    }

    function test_setUpdater() public {
        updaterManager.setHome(address(home));
        updaterManager.setUpdater(updater);
        assertEq(updaterManager.updater(), updater);
    }

    function test_setUpdaterOnlyOwnerFuzzed(address user) public {
        vm.assume(user != address(this));
        updaterManager.setHome(address(home));
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        updaterManager.setUpdater(updater);
    }

    function test_slashUpdater() public {
        address payable reporter = address(0xBEEEEEEF);
        updaterManager.setHome(address(home));
        vm.expectEmit(false, false, false, true);
        emit FakeSlashed(reporter);
        vm.prank(address(home));
        updaterManager.slashUpdater(reporter);
    }

    function test_renounceOwnershipNotChangeOwnership() public {
        address ownerBefore = updaterManager.owner();
        updaterManager.renounceOwnership();
        assertEq(updaterManager.owner(), ownerBefore);
    }
}
