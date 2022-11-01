// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "../upgrade/UpgradeBeaconController.sol";
import {UpgradeTest} from "./utils/UpgradeTest.sol";
import {MockBeacon} from "./utils/MockBeacon.sol";

contract UpgradeBeaconControllerTest is UpgradeTest {
    MockBeacon mockBeacon;

    function setUp() public override {
        super.setUp();
        implAddr = address(this);
        controller = new UpgradeBeaconController();
        controllerAddr = address(controller);
        mockBeacon = new MockBeacon(implAddr, controllerAddr);
        beaconAddr = address(mockBeacon);
    }

    event BeaconUpgraded(address indexed beacon, address implementation);

    function test_upgradeContractOnlyOwner() public {
        // any address that is a contract
        vm.expectEmit(true, false, false, true);
        emit BeaconUpgraded(beaconAddr, implAddr);
        controller.upgrade(beaconAddr, implAddr);
        assertEq(mockBeacon.implementation(), implAddr);
    }

    function test_upgradeAddressFail() public {
        // any address that is a contract
        vm.expectRevert("beacon !contract");
        controller.upgrade(address(0xBEEF), implAddr);
    }

    function test_upgradeNotOwnerFailFuzzed(address user) public {
        vm.assume(user != controller.owner());
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        controller.upgrade(beaconAddr, implAddr);
    }
}
