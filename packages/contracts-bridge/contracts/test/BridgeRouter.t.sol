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
        tokenSender = bridgeUser;
        tokenReceiver = addressToBytes32(vm.addr(3040));
        senderDomain = localDomain;
        receiverDomain = remoteDomain;
    }

    function test_dustAmmount() public {
        assertEq(bridgeRouter.DUST_AMOUNT(), 0.06 ether);
    }

    function test_sendFailZeroRecipient() public {
        bytes32 zeroReceiver = bytes32(0);
        uint256 amount = 100;
        vm.expectRevert("!recip");
        bridgeRouter.send(
            address(localToken),
            amount,
            receiverDomain,
            zeroReceiver,
            false
        );
    }

    event Send(
        address indexed token,
        address indexed from,
        uint32 indexed toDomain,
        bytes32 toId,
        uint256 amount,
        bool fastLiquidityEnabled
    );

    function test_sendLocalTokenFailApprove() public {
        uint256 amount = 100;
        vm.startPrank(tokenSender);
        vm.expectRevert("ERC20: transfer amount exceeds allowance");
        bridgeRouter.send(
            address(localToken),
            amount,
            receiverDomain,
            tokenReceiver,
            fastLiquidityEnabled
        );
        vm.stopPrank();
    }

    function test_sendLocalTokenSuccess() public {
        uint256 amount = 100;
        vm.startPrank(tokenSender);
        // Expect that the ERC20 will emit an event with the approval
        localToken.approve(address(bridgeRouter), 100);
        // Expect the Bridge Router to emit the correct event
        vm.expectEmit(true, true, true, true, address(bridgeRouter));
        emit Send(
            address(localToken),
            tokenSender,
            receiverDomain,
            tokenReceiver,
            amount,
            fastLiquidityEnabled
        );
        bridgeRouter.send(
            address(localToken),
            amount,
            receiverDomain,
            tokenReceiver,
            fastLiquidityEnabled
        );
        vm.stopPrank();
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function test_debitTokensLocalTokensSuccess() public {
        uint256 amount = 100;
        uint256 startingBalance = localToken.balanceOf(address(bridgeRouter));
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Approval(tokenSender, address(bridgeRouter), amount);
        vm.startPrank(tokenSender);
        // Expect that the ERC20 will emit an event with the approval
        localToken.approve(address(bridgeRouter), 100);
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Transfer(tokenSender, address(bridgeRouter), amount);
        bridgeRouter.debitTokens(address(localToken), amount);
        uint256 afterBalance = localToken.balanceOf(address(bridgeRouter));
        assertEq(afterBalance, startingBalance + amount);
        vm.stopPrank();
    }

    function test_debitTokensLocalTokensFailZeroAmount() public {
        uint256 amount = 0;
        vm.expectRevert("!amnt");
        bridgeRouter.debitTokens(address(localToken), amount);
    }

    function test_debitTokensRemoteTokens() public {}

    function test_sendTransferMessage() public {}

    event Receive(
        uint64 indexed originAndNonce,
        address indexed token,
        address indexed recipient,
        address liquidityProvider,
        uint256 amount
    );
}
