// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import {XAppConnectionClientHarness} from "./harnesses/XAppConnectionClientHarness.sol";
import "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

contract XAppConnectionClientTest is Test {
    XAppConnectionClientHarness xAppCnCl;
    XAppConnectionManager xAppCnMngr;
    address home;

    function setUp() public {
        home = vm.addr(213);
        xAppCnCl = new XAppConnectionClientHarness();
        xAppCnMngr = new XAppConnectionManager();
        xAppCnMngr.setHome(home);
        xAppCnCl.exposed_initialize(address(xAppCnMngr));
        assertEq(
            address(xAppCnCl.xAppConnectionManager()),
            address(xAppCnMngr)
        );
        assertEq(address(xAppCnCl.xAppConnectionManager().home()), home);
    }

    function test_setXAppConnectionManager() public {
        home = vm.addr(234);
        XAppConnectionManager xAppCnMngr2 = new XAppConnectionManager();
        xAppCnMngr2.setHome(home);
        xAppCnCl.setXAppConnectionManager(address(xAppCnMngr2));
        assertEq(address(xAppCnCl.xAppConnectionManager().home()), home);
        assertEq(
            address(xAppCnCl.xAppConnectionManager()),
            address(xAppCnMngr2)
        );
    }
}
