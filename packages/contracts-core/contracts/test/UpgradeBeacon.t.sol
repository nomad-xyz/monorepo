// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

// Test imports

import "forge-std/Test.sol";
import {TypeCasts} from "../libs/TypeCasts.sol";
import {UpgradeBeacon} from "../upgrade/UpgradeBeacon.sol";

// External Imports
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

contract UpgradeBeaconTest is Test {
    UpgradeBeacon beacon;

    address controller;
    address implementation;

    event Upgrade(address indexed implementation);

    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    function setUp() public {
        controller = address(0xBEEF);
        // any address that is NOT an EOA
        implementation = address(this);
        vm.expectEmit(true, false, false, false);
        emit Upgrade(implementation);
        beacon = new UpgradeBeacon(implementation, controller);
    }

    function test_constructor() public {
        address storedImplementation = TypeCasts.bytes32ToAddress(
            vm.load(address(beacon), bytes32(0))
        );
        assertEq(storedImplementation, implementation);
        // Immutable variables are part of the bytecode of the contract
        bytes memory data = at(address(beacon));
        bytes29 dataView = data.ref(0);
        assertEq(
            controller,
            TypeCasts.bytes32ToAddress(dataView.index(28, 32))
        );
    }

    function test_fallbackNotController() public {
        (bool success, bytes memory ret) = address(beacon).call("");
        assert(success);
        assertEq(implementation, abi.decode(ret, (address)));
    }

    function test_fallbackNotControllerFuzzed(bytes memory data) public {
        (bool success, bytes memory ret) = address(beacon).call(data);
        assert(success);
        assertEq(implementation, abi.decode(ret, (address)));
    }

    function test_fallbackControllerSuccess() public {
        // any address that is not a EOA
        address newImpl = address(vm);
        vm.startPrank(controller);
        vm.expectEmit(true, false, false, false);
        emit Upgrade(newImpl);
        address(beacon).call(abi.encode(newImpl));
        address storedImplementation = TypeCasts.bytes32ToAddress(
            vm.load(address(beacon), bytes32(0))
        );
        assertEq(storedImplementation, newImpl);
        vm.stopPrank();
    }

    function test_fallbackControllerFailNotContract() public {
        // any address that is not a EOA
        address newImpl = address(0xBEEFEEF);
        vm.startPrank(controller);
        (bool success, bytes memory ret) = address(beacon).call(
            abi.encode(newImpl)
        );
        assertFalse(success);
        assertEq(
            ret.ref(0).slice(4, ret.length - 4, 0).keccak(),
            keccak256(abi.encode("implementation !contract"))
        );
    }

    function test_fallbackControllerFailNotContractFuzzed(address newImpl)
        public
    {
        vm.assume(!Address.isContract(newImpl));
        // any address that is not a EOA
        address newImpl = address(0xBEEFEEF);
        vm.startPrank(controller);
        (bool success, bytes memory ret) = address(beacon).call(
            abi.encode(newImpl)
        );
        assertFalse(success);
        assertEq(
            ret.ref(0).slice(4, ret.length - 4, 0).keccak(),
            keccak256(abi.encode("implementation !contract"))
        );
    }

    function test_fallbackControllerFailSameImpl() public {
        // any address that is not a EOA
        address newImpl = implementation;
        vm.startPrank(controller);
        (bool success, bytes memory ret) = address(beacon).call(
            abi.encode(newImpl)
        );
        assertFalse(success);
        assertEq(
            ret.ref(0).slice(4, ret.length - 4, 0).keccak(),
            keccak256(abi.encode("!upgrade"))
        );
    }

    // Taken from: https://ethereum.stackexchange.com/questions/66554/is-it-possible-to-get-the-bytecode-of-an-already-deployed-contract-in-solidity
    function at(address _addr) public view returns (bytes memory o_code) {
        assembly {
            // retrieve the size of the code, this needs assembly
            let size := extcodesize(_addr)
            // allocate output byte array - this could also be done without assembly
            // by using o_code = new bytes(size)
            o_code := mload(0x40)
            // new "memory end" including padding
            mstore(
                0x40,
                add(o_code, and(add(add(size, 0x20), 0x1f), not(0x1f)))
            )
            // store length in memory
            mstore(o_code, size)
            // actually retrieve the code, this needs assembly
            extcodecopy(_addr, add(o_code, 0x20), 0, size)
        }
    }
}
