// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import {RouterHarness} from "./harnesses/RouterHarness.sol";

contract RouterTest is Test {
    RouterHarness router;

    uint32 testDomain;
    bytes32 testRouter;

    function setUp() public {
        testDomain = 123213;
        testRouter = "router address";
        router = new RouterHarness();
        address xAppConnectionManager = vm.addr(1321);
        router.exposed__XAppConnectionClient_initialize(xAppConnectionManager);
        router.enrollRemoteRouter(testDomain, testRouter);
    }

    function test_enrollRemoteRouter() public {
        bytes32 storedRouter = router.remotes(testDomain);
        assertEq(storedRouter, testRouter);
    }

    function test_enrollRemoteRouterOnlyOwner() public {
        vm.startPrank(vm.addr(1231231231));
        vm.expectRevert("Ownable: caller is not the owner");
        router.enrollRemoteRouter(testDomain, testRouter);
    }

    function test_isRemoteRouter() public {
        assert(router.exposed_isRemoteRouter(testDomain, testRouter));
        assert(!router.exposed_isRemoteRouter(343, bytes32(0)));
        assert(!router.exposed_isRemoteRouter(343, testRouter));
        assert(!router.exposed_isRemoteRouter(testDomain, "not a router"));
        assert(!router.exposed_isRemoteRouter(343, "not a router"));
    }

    function test_mustHaveRemote() public {
        vm.expectRevert("!remote");
        router.exposed_mustHaveRemote(343);
        vm.expectRevert("!remote");
        router.exposed_mustHaveRemote(0);
        vm.expectRevert("!remote");
        router.exposed_mustHaveRemote(type(uint32).max);
        assertEq(router.exposed_mustHaveRemote(testDomain), testRouter);
    }
}
