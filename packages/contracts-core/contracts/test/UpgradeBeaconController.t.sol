// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "../upgrade/UpgradeBeaconController.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract UpgradeBeaconControllerTest is Test {
    UpgradeBeaconController controller;
    FakeBeacon fakeBeacon;
    address beacon;

    function setUp() public {
        fakeBeacon = new FakeBeacon();
        controller = new UpgradeBeaconController();
    }

    event BeaconUpgraded(address indexed beacon, address implementation);

    function test_upgradeContractOnlyOwner() public {
        // any address that is a contract
        address impl = address(this);
        vm.expectEmit(true, false, false, true);
        emit BeaconUpgraded(address(fakeBeacon), impl);
        controller.upgrade(address(fakeBeacon), impl);
        assertEq(fakeBeacon.implementation(), impl);
    }

    function test_upgradeAddressFail() public {
        // any address that is a contract
        address impl = address(this);
        vm.expectRevert("beacon !contract");
        controller.upgrade(address(0xBEEF), impl);
    }

    function test_upgradeNotOwnerFailFuzzed(address user) public {
        vm.assume(user != controller.owner());
        address impl = address(this);
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        controller.upgrade(address(fakeBeacon), impl);
    }
}

// Helper contract is placed in the same source file for readability
// Both test contract and helper contract are small
contract FakeBeacon {
    address public implementation;

    fallback() external payable {
        // snippet from UpgradeBeacon.sol which extracts the implementation address
        // from the calldata. The Controller doesn't encode any function signature, but
        // only encodes the address of the implementation. The Beacon checks if the
        // calling address is the controller and proceeds to do the special functionality.
        address _newImplementation;
        assembly {
            _newImplementation := calldataload(0)
        }
        implementation = _newImplementation;
    }
}
