// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Vm} from "forge-std/Vm.sol";
import {stdCheats, stdError} from "forge-std/stdlib.sol";
import {DSTest} from "ds-test/test.sol";

contract NomadTest is DSTest, stdCheats {
    Vm public constant vm = Vm(HEVM_ADDRESS);

    address updater = vm.addr(1);
    address fakeUpdater = vm.addr(2);
    address signer = vm.addr(3);
    address fakeSigner = vm.addr(4);

    function setUp() public virtual {
        vm.label(updater, "updater");
        vm.label(fakeUpdater, "fake updater");
        vm.label(signer, "signer");
        vm.label(fakeSigner, "fake signer");
    }
}
