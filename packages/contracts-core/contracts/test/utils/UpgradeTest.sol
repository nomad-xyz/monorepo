// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

// Test libraries

// External imports
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import "forge-std/Test.sol";
import {MockImpl} from "./MockImpl.sol";
import {UpgradeBeacon} from "../../upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconController} from "../../upgrade/UpgradeBeaconController.sol";

contract UpgradeTest is Test {
    MockImpl impl;
    UpgradeBeacon beacon;
    UpgradeBeaconController controller;

    address implAddr;
    address beaconAddr;
    address proxyAddr;
    address controllerAddr;

    function setUp() public virtual {
        impl = new MockImpl();
        implAddr = address(impl);
    }

    function isContract(address adr) internal view returns (bool) {
        return Address.isContract(adr);
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
