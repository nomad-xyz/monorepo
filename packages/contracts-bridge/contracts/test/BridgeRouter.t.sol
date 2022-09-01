// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {BridgeTest} from "./utils/BridgeTest.sol";
import {BridgeMessage} from "../BridgeMessage.sol";
import {RevertingToHook} from "./utils/RevertingToHook.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/libs/TypeCasts.sol";
import {BridgeToken} from "../BridgeToken.sol";
import "forge-std/console2.sol";

contract BridgeRouterTest is BridgeTest {
    address tokenSender;
    bytes32 tokenReceiver;

    uint32 receiverDomain;
    uint32 senderDomain;

    bool fastLiquidityEnabled;
    BridgeToken remoteToken;

    RevertingToHook revertingToHook;

    using TypeCasts for bytes32;
    using TypeCasts for address payable;
    using TypeCasts for address;

    function setUp() public override {
        super.setUp();
        tokenSender = bridgeUser;
        tokenReceiver = TypeCasts.addressToBytes32(vm.addr(3040));
        senderDomain = localDomain;
        receiverDomain = remoteDomain;
        revertingToHook = new RevertingToHook();
        remoteToken = BridgeToken(remoteTokenLocalAddress);
    }

    function test_dustAmmountIs006() public {
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
            localDomain,
            tokenReceiver,
            fastLiquidityEnabled
        );
        vm.stopPrank();
    }

    function test_sendLocalTokenDisabled() public {
        uint256 amount = 100;
        vm.startPrank(tokenSender);
        localToken.approve(address(bridgeRouter), amount);
        vm.expectRevert("sends temporarily disabled");
        bridgeRouter.send(
            address(localToken),
            amount,
            receiverDomain,
            tokenReceiver,
            fastLiquidityEnabled
        );
        vm.expectRevert("sends temporarily disabled");
        bridgeRouter.sendToHook(
            address(localToken),
            amount,
            receiverDomain,
            tokenReceiver,
            "0x1234"
        );
    }

    function test_sendRemoteSuccess() public {
        uint256 amount = 100;
        vm.startPrank(tokenSender);
        // Expect that the ERC20 will emit an event with the approval
        remoteToken.approve(address(bridgeRouter), amount);
        // Expect the Bridge Router to emit the correct event
        vm.expectEmit(true, true, true, true, address(bridgeRouter));
        emit Send(
            address(remoteToken),
            tokenSender,
            receiverDomain,
            tokenReceiver,
            amount,
            fastLiquidityEnabled
        );
        bridgeRouter.send(
            address(remoteToken),
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

    function test_takeTokensLocalSuccess() public {
        uint256 amount = 100;
        uint256 startingBalance = localToken.balanceOf(address(bridgeRouter));
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Approval(tokenSender, address(bridgeRouter), amount);
        // Expect that the ERC20 will emit an event with the approval
        vm.startPrank(tokenSender);
        localToken.approve(address(bridgeRouter), amount);
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Transfer(tokenSender, address(bridgeRouter), amount);
        bridgeRouter.takeTokens(address(localToken), amount);
        uint256 afterBalance = localToken.balanceOf(address(bridgeRouter));
        assertEq(afterBalance, startingBalance + amount);
        vm.stopPrank();
    }

    function test_takeTokensLocalFailZeroAmount() public {
        uint256 amount = 0;
        vm.expectRevert("!amnt");
        bridgeRouter.takeTokens(address(localToken), amount);
    }

    function test_takeTokensRemoteSuccess() public {
        uint256 amount = 100;
        uint256 startingBalance = remoteToken.balanceOf(tokenSender);
        vm.startPrank(tokenSender);
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Approval(tokenSender, address(bridgeRouter), amount);
        // Expect that the ERC20 will emit an event with the approval
        localToken.approve(address(bridgeRouter), amount);
        vm.expectEmit(true, true, false, true, address(remoteToken));
        emit Transfer(tokenSender, address(0), amount);
        bridgeRouter.takeTokens(address(remoteToken), amount);
        uint256 afterBalance = remoteToken.balanceOf(tokenSender);
        assertEq(afterBalance, startingBalance - amount);
        vm.stopPrank();
    }

    function test_isAffectedAsset() public view {
        address payable[14] memory affected = mockAccountant.affectedAssets();
        for (uint256 i = 0; i < affected.length; i++) {
            require(mockAccountant.isAffectedAsset(affected[i]));
        }
    }

    event MockAcctCalled(
        address indexed _asset,
        address indexed _user,
        uint256 _amount
    );

    function test_giveLocalUnaffected() public {
        uint256 amount = 1000;
        address recipient = address(33);
        // test with localtoken
        localToken.mint(address(bridgeRouter), amount);
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Transfer(address(bridgeRouter), recipient, amount);
        bridgeRouter.giveLocal(address(localToken), amount, recipient);

        // test with each affected tokens
        // This checks for events on the mock accountant
        // Accountant logic is tested separately
        address payable[14] memory affected = mockAccountant.affectedAssets();
        for (uint256 i = 0; i < affected.length; i++) {
            address a = affected[i];
            vm.expectEmit(
                true,
                true,
                false,
                true,
                address(bridgeRouter.accountant())
            );
            emit MockAcctCalled(a, recipient, amount);
            bridgeRouter.giveLocal(a, amount, recipient);
        }
    }

    function test_handleHookTransferRevertsIfCallFailsMessage() public {
        bytes32 hook = address(revertingToHook).addressToBytes32();
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        bytes32 sender = address(0xBEEF).addressToBytes32();
        localToken.mint(address(bridgeRouter), tokenAmount);
        bytes memory extraData = "sdfdsf";
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.TransferToHook,
            hook,
            tokenAmount,
            tokenDetailsHash,
            sender,
            extraData
        );
        uint32 origin = 123;
        uint32 nonce = 10;
        bytes memory tokenId = abi.encodePacked(
            localDomain,
            address(localToken).addressToBytes32()
        );
        vm.expectRevert("nope!");
        bridgeRouter.exposed_handleTransferToHook(
            origin,
            nonce,
            tokenId,
            action
        );
    }

    function test_handleHookTransferRevertsIfCallFailsNoMessage() public {
        bytes32 hook = address(revertingToHook).addressToBytes32();
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        bytes32 sender = address(0xBEEF).addressToBytes32();
        localToken.mint(address(bridgeRouter), tokenAmount);
        bytes memory extraData = "sdfdsf";
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.TransferToHook,
            hook,
            tokenAmount,
            tokenDetailsHash,
            sender,
            extraData
        );
        uint32 origin = 600;
        uint32 nonce = 10;
        bytes memory tokenId = abi.encodePacked(
            localDomain,
            address(localToken).addressToBytes32()
        );
        vm.expectRevert();
        bridgeRouter.exposed_handleTransferToHook(
            origin,
            nonce,
            tokenId,
            action
        );
    }

    function test_handleHookTransferSucceeds() public {
        bytes32 hook = address(revertingToHook).addressToBytes32();
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        bytes32 sender = address(0xBEEF).addressToBytes32();
        localToken.mint(address(bridgeRouter), tokenAmount);
        bytes memory extraData = "sdfdsf";
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.TransferToHook,
            hook,
            tokenAmount,
            tokenDetailsHash,
            sender,
            extraData
        );
        uint32 origin = 9;
        uint32 nonce = 10;
        bytes memory tokenId = abi.encodePacked(
            localDomain,
            address(localToken).addressToBytes32()
        );
        // The hook succeeds
        bridgeRouter.exposed_handleTransferToHook(
            origin,
            nonce,
            tokenId,
            action
        );
        assertEq(revertingToHook.test(), 123);
    }

    function test_exitBridgeOnly() public {
        address payable[14] memory affected = mockAccountant.affectedAssets();
        for (uint256 i = 0; i < affected.length; i++) {
            vm.expectRevert();
            bridgeRouter.send(
                affected[i],
                1,
                receiverDomain,
                tokenReceiver,
                fastLiquidityEnabled
            );
        }
    }
}
