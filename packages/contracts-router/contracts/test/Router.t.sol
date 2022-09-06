// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import {RouterHarness} from "./harnesses/RouterHarness.sol";

contract MockXcm {
    uint32 immutable domain;
    constructor (uint32 d) {
        domain = d;
    }
    function localDomain() external view returns (uint32) {
        return domain;
    }
}

contract RouterTest is Test {
    RouterHarness router;

    uint32 testDomain;
    bytes32 testRouter;

    uint32 constant localDomain = 111;

    function setUp() public {
        // deploy and initialize router
        router = new RouterHarness();
        address xAppConnectionManager = address(new MockXcm(localDomain));
        router.exposed__XAppConnectionClient_initialize(xAppConnectionManager);
        testDomain = 123213;
        testRouter = "router address";
        // Make sure that Router is not enrolled yet
        assertEq(router.remotes(testDomain), bytes32(0));
    }

    function test_enrollRemoteRouter() public {
        uint32 newDomain = 12;
        bytes32 newRouter = "0xBEEF";
        assertEq(router.remotes(newDomain), bytes32(0));
        assertFalse(router.exposed_isRemoteRouter(newDomain, newRouter));
        router.enrollRemoteRouter(newDomain, newRouter);
    }

    function test_enrollRemoteRouterFuzzed(uint32 newDomain, bytes32 newRouter)
        public
    {
        if (newDomain == localDomain || newDomain == 0) {
            vm.expectRevert("!domain");
        } else {

            assertEq(router.remotes(newDomain), bytes32(0));
            assertFalse(router.exposed_isRemoteRouter(newDomain, newRouter));
        }
        router.enrollRemoteRouter(newDomain, newRouter);
    }

    function test_enrollRemoteRouterOnlyOwner() public {
        vm.startPrank(vm.addr(1231231231));
        vm.expectRevert("Ownable: caller is not the owner");
        router.enrollRemoteRouter(testDomain, testRouter);
    }

    function test_enrollRemoteRouterOnlyOwnerFuzzed(address user) public {
        vm.assume(user != address(router.owner()));
        vm.startPrank(user);
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
