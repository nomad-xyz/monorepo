// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import {XAppConnectionClientHarness} from "./harnesses/XAppConnectionClientHarness.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";

contract XAppConnectionClientTest is Test {
    XAppConnectionClientHarness client;
    XAppConnectionManager manager;
    address home;

    function setUp() public {
        home = vm.addr(213);
        manager = new XAppConnectionManager();
        manager.setHome(home);
        client = new XAppConnectionClientHarness();
        client.exposed_initialize(address(manager));
        assertEq(address(client.xAppConnectionManager()), address(manager));
        assertEq(address(client.xAppConnectionManager().home()), home);
        assertEq(client.owner(), address(this));
    }

    function test_setXAppConnectionManager() public {
        home = vm.addr(234);
        XAppConnectionManager manager2 = new XAppConnectionManager();
        manager2.setHome(home);
        client.setXAppConnectionManager(address(manager2));
        assertEq(address(client.xAppConnectionManager().home()), home);
        assertEq(address(client.xAppConnectionManager()), address(manager2));
    }

    function test_setXAppConnectionManagerOnlyOwner() public {
        address notOwner = vm.addr(12334);
        vm.startPrank(notOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        client.setXAppConnectionManager(address(vm.addr(123123)));
    }

    function test_exposedHome() public {
        assertEq(address(client.exposed_home()), home);
        assertEq(address(client.exposed_home()), address(manager.home()));
    }

    function test_isReplica() public {
        // IS NOT Replica
        address notReplica = vm.addr(1231335234);
        assert(!client.exposed_isReplica(notReplica));
        // IS REPLICA
        address replica = vm.addr(123213);
        uint32 domain = 2134;
        manager.ownerEnrollReplica(replica, domain);
        assert(client.exposed_isReplica(replica));
    }

    function test_localDomain() public {
        uint32 localDomain = 1234;
        Home homeContract = new Home(localDomain);
        manager.setHome(address(homeContract));
        assertEq(uint256(client.exposed_localDomain()), uint256(localDomain));
    }
}
