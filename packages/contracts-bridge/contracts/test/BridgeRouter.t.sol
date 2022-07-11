// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {BridgeTest} from "./utils/BridgeTest.sol";

contract BridgeRouterTest is BridgeTest {
    address tokenSender;
    bytes32 tokenReceiver;

    uint32 receiverDomain;
    uint32 senderDomain;

    bool fastLiquidityEnabled;

    function setUp() public override {
        super.setUp();
        tokenSender = address(this);
        tokenReceiver = addressToBytes32(vm.addr(3040));
    }

    function test_dustAmmount() public {
        assertEq(bridgeRouter.DUST_AMOUNT(), 0.06 ether);
    }

    function test_sendFailZeroRecipient() public {
        address token = vm.addr(123);
        bytes32 zeroReceiver = bytes32(0);
        uint256 amount = 100;
        vm.expectRevert("!recip");
        bridgeRouter.send(token, amount, receiverDomain, zeroReceiver, false);
    }

    event Send(
        address indexed token,
        address indexed from,
        uint32 indexed toDomain,
        bytes32 toId,
        uint256 amount,
        bool fastLiquidityEnabled
    );

    function test_sendFailTokenLocalDomain() public {
        address token = vm.addr(123);
        uint256 amount = 100;
        vm.expectRevert();
        bridgeRouter.send(
            token,
            amount,
            receiverDomain,
            tokenReceiver,
            fastLiquidityEnabled
        );
    }

    event Receive(
        uint64 indexed originAndNonce,
        address indexed token,
        address indexed recipient,
        address liquidityProvider,
        uint256 amount
    );
}
