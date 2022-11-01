// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

// Test imports
import {TypeCasts} from "../libs/TypeCasts.sol";
import {UpgradeBeacon} from "../upgrade/UpgradeBeacon.sol";
import {UpgradeTest} from "./utils/UpgradeTest.sol";

// External Imports
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

contract UpgradeBeaconTest is UpgradeTest {
    event Upgrade(address indexed implementation);

    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    function setUp() public override {
        super.setUp();
        controllerAddr = address(0xBEEF);
        // any address that is NOT an EOA
        implAddr = address(this);
        vm.expectEmit(true, false, false, false);
        emit Upgrade(implAddr);
        beacon = new UpgradeBeacon(implAddr, controllerAddr);
        beaconAddr = address(beacon);
    }

    function test_constructor() public {
        address storedImplementation = TypeCasts.bytes32ToAddress(
            vm.load(beaconAddr, bytes32(0))
        );
        assertEq(storedImplementation, implAddr);
        // Immutable variables are part of the bytecode of the contract
        bytes memory data = at(beaconAddr);
        bytes29 dataView = data.ref(0);
        assertEq(
            controllerAddr,
            TypeCasts.bytes32ToAddress(dataView.index(28, 32))
        );
    }

    function test_fallbackNotController() public {
        (bool success, bytes memory ret) = beaconAddr.call("");
        assert(success);
        assertEq(implAddr, abi.decode(ret, (address)));
    }

    function test_fallbackNotControllerFuzzed(bytes memory data) public {
        (bool success, bytes memory ret) = beaconAddr.call(data);
        assert(success);
        assertEq(implAddr, abi.decode(ret, (address)));
    }

    function test_fallbackControllerSuccess() public {
        // any address that is not a EOA
        address newImpl = address(vm);
        vm.startPrank(controllerAddr);
        vm.expectEmit(true, false, false, false);
        emit Upgrade(newImpl);
        beaconAddr.call(abi.encode(newImpl));
        address storedImplementation = TypeCasts.bytes32ToAddress(
            vm.load(beaconAddr, bytes32(0))
        );
        assertEq(storedImplementation, newImpl);
        vm.stopPrank();
    }

    function test_fallbackControllerFailNotContract() public {
        // any address that is not a EOA
        address newImpl = address(0xBEEFEEF);
        vm.startPrank(controllerAddr);
        (bool success, bytes memory ret) = beaconAddr.call(abi.encode(newImpl));
        assertFalse(success);
        assertEq(
            ret,
            abi.encodeWithSignature("Error(string)", "implementation !contract")
        );
    }

    function test_fallbackControllerFailNotContractFuzzed(address newImpl)
        public
    {
        vm.assume(!Address.isContract(newImpl));
        vm.startPrank(controllerAddr);
        (bool success, bytes memory ret) = beaconAddr.call(abi.encode(newImpl));
        assertFalse(success);
        assertEq(
            ret,
            abi.encodeWithSignature("Error(string)", "implementation !contract")
        );
    }

    function test_fallbackControllerFailSameImpl() public {
        // any address that is not a EOA
        address newImpl = implAddr;
        vm.startPrank(controllerAddr);
        (bool success, bytes memory ret) = beaconAddr.call(abi.encode(newImpl));
        assertFalse(success);
        assertEq(
            ret.ref(0).slice(4, ret.length - 4, 0).keccak(),
            keccak256(abi.encode("!upgrade"))
        );
    }
}
