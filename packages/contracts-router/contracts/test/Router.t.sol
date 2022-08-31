// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import {RouterHarness} from "./harnesses/RouterHarness.sol";

contract RouterTest is Test {
    RouterHarness router;

    uint32 testDomain;
    bytes32 testRouter;

    function setUp() public {
        // deploy and initialize router
        router = new RouterHarness();
        address xAppConnectionManager = vm.addr(1321);
        router.exposed__XAppConnectionClient_initialize(xAppConnectionManager);
        testDomain = 123213;
        testRouter = "router address";
        // Make sure that Router is not enrolled yet
        assertEq(router.remotes(testDomain), bytes32(0));
        assertFalse(router.exposed_isRemoteRouter(testDomain, testRouter));
        vm.expectRevert("!remote");
        router.exposed_mustHaveRemote(testDomain);
    }

    function test_enrollRemoteRouter() public {
        assertEq(router.remotes(testDomain), bytes32(0));
        router.enrollRemoteRouter(testDomain, testRouter);
        assertEq(router.remotes(testDomain), testRouter);
    }

    function test_enrollRemoteRouterOnlyOwner() public {
        vm.startPrank(vm.addr(1231231231));
        vm.expectRevert("Ownable: caller is not the owner");
        router.enrollRemoteRouter(testDomain, testRouter);
    }

    function test_isRemoteRouter() public {
        router.enrollRemoteRouter(testDomain, testRouter);
        assert(router.exposed_isRemoteRouter(testDomain, testRouter));
        assert(!router.exposed_isRemoteRouter(343, bytes32(0)));
        assert(!router.exposed_isRemoteRouter(343, testRouter));
        assert(!router.exposed_isRemoteRouter(testDomain, "not a router"));
        assert(!router.exposed_isRemoteRouter(343, "not a router"));
    }

    function test_isRemoteRouterFuzzed(uint32 domain, bytes32 routerAddress)
        public
    {
        assertFalse(router.exposed_isRemoteRouter(domain, routerAddress));
    }

    function test_mustHaveRemote() public {
        router.enrollRemoteRouter(testDomain, testRouter);
        assertEq(router.exposed_mustHaveRemote(testDomain), testRouter);
        vm.expectRevert("!remote");
        router.exposed_mustHaveRemote(343);
        vm.expectRevert("!remote");
        router.exposed_mustHaveRemote(0);
        vm.expectRevert("!remote");
        router.exposed_mustHaveRemote(type(uint32).max);
    }

    function test_mustHaveRemoteFuzzed(uint32 domain) public {
        vm.expectRevert("!remote");
        router.exposed_mustHaveRemote(domain);
    }
}
