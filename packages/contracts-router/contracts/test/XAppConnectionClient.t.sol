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

    function test_setXAppConnectionManagerOnlyOwner() public {
        address notOwner = vm.addr(12334);
        vm.startPrank(notOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        xAppCnCl.setXAppConnectionManager(address(vm.addr(123123)));
    }

    function test_exposedHome() public {
        assertEq(address(xAppCnCl.exposed_home()), home);
        assertEq(address(xAppCnCl.exposed_home()), address(xAppCnMngr.home()));
    }

    function test_isReplica() public {
        address notReplica = vm.addr(1231335234);
        address replica = vm.addr(123213);
        uint32 domain = 2134;
        assert(!xAppCnCl.exposed_isReplica(notReplica));
        xAppCnMngr.ownerEnrollReplica(replica, domain);
        assert(xAppCnCl.exposed_isReplica(replica));
    }

    function test_localDomain() public {
        uint32 localDomain = 1234;
        Home homeContract = new Home(localDomain);
        xAppCnMngr.setHome(address(homeContract));
        assertEq(uint256(xAppCnCl.exposed_localDomain()), uint256(localDomain));
    }
}
