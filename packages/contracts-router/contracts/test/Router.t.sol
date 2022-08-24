// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import {RouterHarness} from "./harnesses/RouterHarness.sol";

contract RouterTest is Test {
    RouterHarness router;

    function setUp() public {
        router = new RouterHarness();
        address xAppConnectionManager = vm.addr(1321);
        router.exposed__XAppConnectionClient_initialize(xAppConnectionManager);
    }

    function test_handle() public {
        uint32 domain = 123;
        uint32 nonce = 1;
        bytes32 sender = "sender";
        bytes memory message = hex"0e34";
        router.handle(domain, nonce, sender, message);
        (
            uint32 handledDomain,
            uint32 handledNonce,
            bytes32 handledSender,
            bytes memory handledMessage
        ) = router.handledMessages(0);
        assertEq(uint256(handledDomain), uint256(domain));
        assertEq(uint256(handledNonce), uint256(nonce));
        assertEq(handledSender, sender);
        assertEq(handledMessage, message);
    }

    function test_enrollRemoteRouter() public {
        uint32 domain = 123;
        bytes32 routerAddress = "router address";
        vm.startPrank(router.owner());
        router.enrollRemoteRouter(domain, routerAddress);
        bytes32 storedRouter = router.remotes(domain);
        assertEq(storedRouter, routerAddress);
        vm.stopPrank();
    }

    function test_enrollRemoteRouterOnlyOwner() public {
        uint32 domain = 123;
        bytes32 routerAddress = "router address";
        vm.startPrank(vm.addr(1231231231));
        vm.expectRevert("Ownable: caller is not the owner");
        router.enrollRemoteRouter(domain, routerAddress);
        bytes32 storedRouter = router.remotes(domain);
        vm.stopPrank();
    }
}
