// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// Local Imports
import {BridgeMessage} from "packages/contracts-bridge/contracts/BridgeMessage.sol";
import {BridgeTestFixture} from "packages/contracts-bridge/contracts/test/utils/BridgeTest.sol";
import {BridgeToken} from "packages/contracts-bridge/contracts/BridgeToken.sol";
import {EthereumBridgeRouterHarness} from "packages/contracts-bridge/contracts/test/harness/BridgeRouterHarness.sol";
import {TypeCasts} from "packages/contracts-core/contracts/libs/TypeCasts.sol";
import {RevertingToHook} from "packages/contracts-bridge/contracts/test/utils/RevertingToHook.sol";
import {MockHome} from "./utils/MockHome.sol";
// External Imports
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {Test, console2} from "forge-std/Test.sol";

/// @notice The default bridgeRouter is BridgeRouter (BaseBridgeRouter)
/// @dev It should implement common functionality between nonEthereumBridgeRouter and
/// EthereumBridgeRouter
abstract contract BridgeRouterBaseTest is BridgeTestFixture {
    address tokenSender;
    bytes32 tokenReceiver;

    uint32 receiverDomain;
    uint32 senderDomain;

    bool fastLiquidityEnabled;

    RevertingToHook revertingToHook;
    MockHome home;

    using TypeCasts for bytes32;
    using TypeCasts for address payable;
    using TypeCasts for address;
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using BridgeMessage for bytes29;

    function setUp() public virtual override {
        super.setUp();
        tokenSender = bridgeUser;
        tokenReceiver = vm.addr(3040).addressToBytes32();
        senderDomain = homeDomain;
        receiverDomain = remoteDomain;
        revertingToHook = new RevertingToHook();

        home = new MockHome(homeDomain);
    }

    function test_dustAmmountIs006() public {
        assertEq(bridgeRouter.DUST_AMOUNT(), 0.06 ether);
    }

    function test_handleRevertsIfNotCalledByReplica() public {
        uint32 nonce = 23;
        bytes memory message = "lol";
        bytes32 sender = remoteBridgeRouter;
        vm.expectRevert("!replica");
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
    }

    function test_handleRevertsIfSenderNotRegisteredRouter() public {
        uint32 nonce = 23;
        bytes memory message = "lol";
        bytes32 sender = address(0xBEEF).addressToBytes32();
        vm.prank(mockReplica);
        vm.expectRevert("!remote router");
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
    }

    // The only registured remote router is for domain = remoteDomain and sender = remoteBridgeRouter
    function testFuzz_handleRevertsIfSenderNotRegisteredRouter(
        bytes32 sender,
        uint32 domain
    ) public {
        vm.assume(domain != remoteDomain && sender != remoteBridgeRouter);
        uint32 nonce = 23;
        bytes memory message = "lol";
        vm.prank(mockReplica);
        vm.expectRevert("!remote router");
        bridgeRouter.handle(domain, nonce, sender, message);
    }

    function test_handleRevertsIfSenderNotCorrectDomain() public {
        uint32 nonce = 23;
        bytes memory message = "lol";
        bytes32 sender = remoteBridgeRouter;
        vm.prank(mockReplica);
        vm.expectRevert("!remote router");
        bridgeRouter.handle(123, nonce, sender, message);
    }

    function test_handleRevertsIfMalformedMessage() public {
        uint32 nonce = 23;
        bytes memory message = "lol";
        bytes32 sender = remoteBridgeRouter;
        vm.prank(mockReplica);
        vm.expectRevert("Validity assertion failed");
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
    }

    function test_handleRevertsIfInvalidAction() public {
        uint32 nonce = 23;
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        // Invalid
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Invalid,
            tokenReceiver,
            tokenAmount,
            tokenDetailsHash
        );
        bytes32 id = address(localToken).addressToBytes32();
        bytes memory tokenId = abi.encodePacked(remoteDomain, id);
        bytes32 sender = remoteBridgeRouter;
        bytes memory message = abi.encodePacked(tokenId, action);
        vm.prank(mockReplica);
        vm.expectRevert("!valid action");
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
    }

    /// @notice Test that the only valid actions are the enums Message.Types.TransferToHook
    /// and Message.Types.Message, which in numbers are 5 and 3 respectively.
    /// If the enumAction was a larger number, we get the Validity assertion failed error,
    /// as the message is not of the correct form
    function test_handleRevertsIfInvalidAction(uint8 enumAction) public {
        vm.assume(enumAction != 3 && enumAction != 5);
        uint32 nonce = 23;
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        // Invalid
        bytes memory action = abi.encodePacked(
            enumAction,
            tokenReceiver,
            tokenAmount,
            tokenDetailsHash
        );
        bytes32 id = address(localToken).addressToBytes32();
        bytes memory tokenId = abi.encodePacked(remoteDomain, id);
        bytes32 sender = remoteBridgeRouter;
        bytes memory message = abi.encodePacked(tokenId, action);
        vm.prank(mockReplica);
        vm.expectRevert("!valid action");
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
    }

    function test_handleRevertsIfMalformedAction() public {
        uint32 nonce = 23;
        uint256 tokenAmount = 100;
        // it should be bytes32
        string memory tokenDetailsHash = "sdf";
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            tokenReceiver,
            tokenAmount,
            tokenDetailsHash
        );
        bytes32 id = address(localToken).addressToBytes32();
        bytes memory tokenId = abi.encodePacked(remoteDomain, id);
        bytes32 sender = remoteBridgeRouter;
        bytes memory message = abi.encodePacked(tokenId, action);
        vm.prank(mockReplica);
        vm.expectRevert("Validity assertion failed");
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
    }

    function test_handleRevertsIfMalformedTokenId() public {
        uint32 nonce = 23;
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        // Invalid
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            tokenReceiver,
            tokenAmount,
            tokenDetailsHash
        );
        // it should be bytes32
        address id = address(localToken);
        bytes memory tokenId = abi.encodePacked(remoteDomain, id);
        bytes32 sender = remoteBridgeRouter;
        bytes memory message = abi.encodePacked(tokenId, action);
        vm.prank(mockReplica);
        vm.expectRevert("Validity assertion failed");
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
    }

    function test_handleSuccessTransfer() public {
        uint32 nonce = 23;
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        // Invalid
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            tokenReceiver,
            tokenAmount,
            tokenDetailsHash
        );
        bytes32 id = address(localToken).addressToBytes32();
        bytes memory tokenId = abi.encodePacked(homeDomain, id);
        bytes32 sender = remoteBridgeRouter;
        bytes memory message = abi.encodePacked(tokenId, action);
        localToken.mint(address(bridgeRouter), 100);
        vm.prank(mockReplica);
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
        assertEq(localToken.balanceOf(tokenReceiver.bytes32ToAddress()), 100);
    }

    function testFuzz_handleSuccessTransfer(
        uint32 nonce,
        uint256 tokenAmount,
        bytes32 tokenDetailsHash
    ) public {
        // We have already minted bridgeUserTokenAmount of tokens during
        // setUp(). We bound that so we don't revert because of math overflow
        tokenAmount = bound(
            tokenAmount,
            0,
            type(uint256).max - bridgeUserTokenAmount
        );
        localToken.mint(address(bridgeRouter), tokenAmount);
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            tokenReceiver,
            tokenAmount,
            tokenDetailsHash
        );
        bytes32 id = address(localToken).addressToBytes32();
        bytes memory tokenId = abi.encodePacked(homeDomain, id);
        bytes32 sender = remoteBridgeRouter;
        bytes memory message = abi.encodePacked(tokenId, action);
        vm.prank(mockReplica);
        bridgeRouter.handle(remoteDomain, nonce, sender, message);
        assertEq(
            localToken.balanceOf(tokenReceiver.bytes32ToAddress()),
            tokenAmount
        );
    }

    function test_handleSuccessTransferToHook() public {
        bytes32 hook = address(revertingToHook).addressToBytes32();
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        bytes32 sender = remoteBridgeRouter;
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
        uint32 nonce = 10;
        uint32 origin = 1;
        // Enroll a router for the domain = 1
        bridgeRouter.enrollRemoteRouter(origin, remoteBridgeRouter);
        bytes memory tokenId = abi.encodePacked(
            homeDomain,
            address(localToken).addressToBytes32()
        );
        bytes memory message = abi.encodePacked(tokenId, action);
        vm.prank(mockReplica);
        bridgeRouter.handle(origin, nonce, sender, message);
        assertEq(revertingToHook.test(), 123);
    }

    function testFuzz_handleSuccessTransferToHook(
        uint256 tokenAmount,
        bytes32 tokenDetailsHash,
        bytes memory extraData
    ) public {
        // We have already minted bridgeUserTokenAmount of tokens during
        // setUp(). We bound that so we don't revert because of math overflow
        tokenAmount = bound(
            tokenAmount,
            0,
            type(uint256).max - bridgeUserTokenAmount
        );
        bytes32 hook = address(revertingToHook).addressToBytes32();
        bytes32 sender = remoteBridgeRouter;
        localToken.mint(address(bridgeRouter), tokenAmount);
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.TransferToHook,
            hook,
            tokenAmount,
            tokenDetailsHash,
            sender,
            extraData
        );
        uint32 nonce = 10;
        uint32 origin = 1;
        // Enroll a router for the domain = 1
        bridgeRouter.enrollRemoteRouter(origin, remoteBridgeRouter);
        bytes memory tokenId = abi.encodePacked(
            homeDomain,
            address(localToken).addressToBytes32()
        );
        bytes memory message = abi.encodePacked(tokenId, action);
        vm.prank(mockReplica);
        bridgeRouter.handle(origin, nonce, sender, message);
        assertEq(revertingToHook.test(), 123);
        assertEq(localToken.balanceOf(address(revertingToHook)), tokenAmount);
    }

    function test_sendRevertsIfRecipientIsZero() public {
        address token = address(localToken);
        uint256 amount = 100;
        bytes32 recipient = bytes32(0);
        vm.expectRevert("!recip");
        bridgeRouter.send(token, amount, receiverDomain, recipient, true);
    }

    function test_sendLocalRevertsTokenDisabled() public {
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

    event Send(
        address indexed token,
        address indexed from,
        uint32 indexed toDomain,
        bytes32 toId,
        uint256 amount,
        bool fastLiquidityEnabled
    );

    function test_sendLocalTokenRevertsIfNotApprove() public {
        uint256 amount = 100;
        vm.startPrank(tokenSender);
        vm.expectRevert("ERC20: transfer amount exceeds allowance");
        bridgeRouter.send(
            address(localToken),
            amount,
            homeDomain,
            tokenReceiver,
            fastLiquidityEnabled
        );
        vm.stopPrank();
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

    function test_enrollCustomRevertsIfNotOwner() public {
        vm.prank(address(0xBEEF));
        uint32 domain = remoteDomain;
        bytes32 id = "sf";
        address custom = address(this);
        vm.expectRevert("Ownable: caller is not the owner");
        bridgeRouter.enrollCustom(domain, id, custom);
    }

    function test_enrollCustomRevertsIfBridgeNotOwner() public {
        // Let's assume that newToken (BrigeToken) is a custom
        // token deployed by some DAO and that it's the representation
        // of the token with id = "remoteAddress"
        uint32 domain = remoteDomain;
        bytes32 id = "remoteAddress";
        address custom = address(new BridgeToken());
        BridgeToken(custom).initialize();
        vm.expectRevert("Ownable: caller is not the owner");
        bridgeRouter.enrollCustom(domain, id, custom);
    }

    function test_enrollCustomSuccess() public {
        // Let's assume that newToken (BrigeToken) is a custom
        // token deployed by some DAO and that it's the representation
        // of the token with id = "remoteAddress"
        uint32 domain = remoteDomain;
        bytes32 id = "remoteAddress";
        address custom = address(new BridgeToken());
        BridgeToken(custom).initialize();
        BridgeToken(custom).transferOwnership(address(bridgeRouter));
        uint256 supply = localToken.totalSupply();
        bridgeRouter.enrollCustom(domain, id, custom);
        // We mint a token to make sure we have the appropriate ownership set
        // We want to make sure we burn it afterwards
        assertEq(localToken.totalSupply(), supply);
        bytes29 tokenId = BridgeMessage.formatTokenId(domain, id);
        assertEq(
            tokenRegistry.canonicalToRepresentation(tokenId.keccak()),
            custom
        );
        (uint32 returnedDomain, bytes32 returnedId) = tokenRegistry
            .representationToCanonical(custom);
        assertEq(returnedDomain, uint256(domain));
        assertEq(returnedId, id);
    }

    function testFuzz_enrollCustomSuccess(uint32 domain, bytes32 id) public {
        address custom = address(new BridgeToken());
        BridgeToken(custom).initialize();
        BridgeToken(custom).transferOwnership(address(bridgeRouter));
        uint256 supply = localToken.totalSupply();
        if (domain == 0) {
            vm.expectRevert("!null domain");
        }
        bridgeRouter.enrollCustom(domain, id, custom);
        // if domain = 0, the transaction will revert (as caught above) and thus
        // we shouldn't perform an assertions
        if (domain == 0) {
            return;
        }
        // We mint a token to make sure we have the appropriate ownership set
        // We want to make sure we burn it afterwards
        assertEq(localToken.totalSupply(), supply);
        bytes29 tokenId = BridgeMessage.formatTokenId(domain, id);
        assertEq(
            tokenRegistry.canonicalToRepresentation(tokenId.keccak()),
            custom
        );
        (uint32 returnedDomain, bytes32 returnedId) = tokenRegistry
            .representationToCanonical(custom);
        assertEq(returnedDomain, uint256(domain));
        assertEq(returnedId, id);
    }

    function test_migrateRevertsIfSameRepr() public {
        vm.expectRevert("!different");
        bridgeRouter.migrate(remoteTokenLocalAddress);
    }

    function test_migrateSuccess() public {
        uint32 domain = remoteDomain;
        bytes32 id = "remoteAddress";
        address user = address(0xBEEEF);
        address custom = address(new BridgeToken());
        BridgeToken(custom).initialize();
        BridgeToken(custom).transferOwnership(address(bridgeRouter));
        bridgeRouter.enrollCustom(domain, id, custom);
        vm.prank(address(bridgeRouter));
        BridgeToken(custom).mint(user, 1000);
        address newCustom = address(new BridgeToken());
        BridgeToken(newCustom).initialize();
        BridgeToken(newCustom).transferOwnership(address(bridgeRouter));
        // Enroll a new representation of the same remote token
        bridgeRouter.enrollCustom(domain, id, newCustom);
        // Execute as the user who wants to migrate their tokens
        vm.prank(user);
        bridgeRouter.migrate(custom);
        // old tokens have been burned
        assertEq(BridgeToken(custom).balanceOf(user), 0);
        // new tokens have been minted
        assertEq(BridgeToken(newCustom).balanceOf(user), 1000);
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
        uint256 startingSupply = localToken.totalSupply();
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Approval(tokenSender, address(bridgeRouter), amount);
        // Expect that the ERC20 will emit an event with the approval
        vm.startPrank(tokenSender);
        localToken.approve(address(bridgeRouter), amount);
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Transfer(tokenSender, address(bridgeRouter), amount);
        bridgeRouter.exposed_takeTokens(address(localToken), amount);
        uint256 afterBalance = localToken.balanceOf(address(bridgeRouter));
        assertEq(afterBalance, startingBalance + amount);
        assertEq(localToken.totalSupply(), startingSupply);
        vm.stopPrank();
    }

    function test_takeTokensLocalFailZeroAmount() public {
        uint256 amount = 0;
        vm.expectRevert("!amnt");
        bridgeRouter.exposed_takeTokens(address(localToken), amount);
    }

    function test_takeTokensRemoteSuccess() public {
        uint256 amount = 100;
        uint256 startingBalance = remoteToken.balanceOf(tokenSender);
        uint256 startingSupply = remoteToken.totalSupply();
        vm.startPrank(tokenSender);
        vm.expectEmit(true, true, false, true, address(remoteToken));
        emit Approval(tokenSender, address(bridgeRouter), amount);
        // Expect that the ERC20 will emit an event with the approval
        remoteToken.approve(address(bridgeRouter), amount);
        vm.expectEmit(true, true, false, true, address(remoteToken));
        emit Transfer(tokenSender, address(0), amount);
        bridgeRouter.exposed_takeTokens(address(remoteToken), amount);
        uint256 afterBalance = remoteToken.balanceOf(tokenSender);
        assertEq(afterBalance, startingBalance - amount);
        assertEq(remoteToken.totalSupply(), startingSupply - amount);
        vm.stopPrank();
    }

    // We test the correct returned data in the send() tests.
    // It returnes a bytes29 pointed that is invalid, since it refers to
    // the memory of the contract, not the test contract. It doesn't
    // make sense outside the memoroy context of the BridgeRouter

    function test_sendTransferMessage() public {
        uint32 destination = remoteDomain;
        bytes32 _tokenReceiver = address(0xBEEF).addressToBytes32();
        uint256 tokenAmount = 1000;
        bytes32 tokenDetailsHash = "details";
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            _tokenReceiver,
            tokenAmount,
            tokenDetailsHash
        );
        // let's assume we send a representation of a remote token
        bytes32 tokenAddress = remoteTokenLocalAddress.addressToBytes32();
        bytes memory tokenId = abi.encodePacked(homeDomain, tokenAddress);
        bytes memory message = abi.encodePacked(tokenId, action);
        vm.expectEmit(true, true, true, true);
        home.hack_expectDispatchEvent(
            destination,
            remoteBridgeRouter,
            message,
            address(bridgeRouter)
        );
        bridgeRouter.exposed_sendTransferMessage(destination, tokenId, action);
    }

    function test_handleTransferSucceedsIfRecipientNotEvmAddress() public {
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "sdf";
        bytes32 recipient = "not an address";
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            recipient,
            tokenAmount,
            tokenDetailsHash
        );
        uint32 origin = remoteDomain;
        uint32 nonce = 10;
        bytes memory tokenId = abi.encodePacked(
            homeDomain,
            address(localToken).addressToBytes32()
        );
        localToken.mint(address(bridgeRouter), tokenAmount);
        vm.deal(address(bridgeRouter), bridgeRouter.DUST_AMOUNT());
        bridgeRouter.exposed_handleTransfer(origin, nonce, tokenId, action);
        assertEq(
            localToken.balanceOf(recipient.bytes32ToAddress()),
            tokenAmount
        );
        assertEq(
            recipient.bytes32ToAddress().balance,
            bridgeRouter.DUST_AMOUNT()
        );
    }

    function testFuzz_handleTransferSucceedsIfRecipienttNotRevert(
        uint256 tokenAmount,
        bytes32 tokenDetailsHash,
        uint32 nonce,
        uint32 origin
    ) public {
        // We have already minted bridgeUserTokenAmount of tokens during
        // setUp(). We bound that so we don't revert because of math overflow
        bytes32 recipient = "asdfasfasdf";
        tokenAmount = bound(
            tokenAmount,
            0,
            type(uint256).max - bridgeUserTokenAmount
        );
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            recipient,
            tokenAmount,
            tokenDetailsHash
        );
        bytes memory tokenId = abi.encodePacked(
            homeDomain,
            address(localToken).addressToBytes32()
        );
        localToken.mint(address(bridgeRouter), tokenAmount);
        vm.deal(address(bridgeRouter), bridgeRouter.DUST_AMOUNT());
        bool dusted;
        if (nonce % 2 == 1) {
            dusted = true;
            vm.deal(recipient.bytes32ToAddress(), bridgeRouter.DUST_AMOUNT());
        }
        if (recipient.bytes32ToAddress() == address(0)) {
            vm.expectRevert("ERC20: transfer to the zero address");
            bridgeRouter.exposed_handleTransfer(origin, nonce, tokenId, action);
            // so we don't run the assertions
            return;
        }
        bridgeRouter.exposed_handleTransfer(origin, nonce, tokenId, action);
        assertEq(
            localToken.balanceOf(recipient.bytes32ToAddress()),
            tokenAmount
        );
        if (dusted) {
            assertEq(
                recipient.bytes32ToAddress().balance,
                bridgeRouter.DUST_AMOUNT()
            );
            assertEq(address(bridgeRouter).balance, bridgeRouter.DUST_AMOUNT());
            return;
        }
        assertEq(
            recipient.bytes32ToAddress().balance,
            bridgeRouter.DUST_AMOUNT()
        );
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
            homeDomain,
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
            homeDomain,
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
            homeDomain,
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

    function testFuzz_handleHookTransferSucceeds(
        uint256 tokenAmount,
        bytes32 tokenDetailsHash,
        bytes memory extraData,
        bytes32 sender,
        uint32 nonce
    ) public {
        tokenAmount = bound(
            tokenAmount,
            0,
            type(uint256).max - bridgeUserTokenAmount
        );
        bytes32 hook = address(revertingToHook).addressToBytes32();
        // The hook will succed only if origin < 10. This has nothing
        // to do with how transferToHook works, but rather how the mock works.
        // We created a mock that will have different behaviour depending on the origin,
        // so that we can test different scenarios easily.
        uint32 origin = 1;
        localToken.mint(address(bridgeRouter), tokenAmount);
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.TransferToHook,
            hook,
            tokenAmount,
            tokenDetailsHash,
            sender,
            extraData
        );
        bytes memory tokenId = abi.encodePacked(
            homeDomain,
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

    function test_dust() public {
        address alice = address(0xBEEEEF);
        address bob = address(0xBEEEEEEEEEF);
        vm.deal(alice, 10 ether);
        vm.deal(address(bridgeRouter), 20 ether);

        bridgeRouter.exposed_dust(alice);
        bridgeRouter.exposed_dust(bob);

        assertEq(alice.balance, 10 ether);
        assertEq(bob.balance, bridgeRouter.DUST_AMOUNT());
        assertEq(
            address(bridgeRouter).balance,
            20 ether - bridgeRouter.DUST_AMOUNT()
        );
    }

    function testFuzz_originAndNonce(uint32 origin, uint32 nonce) public {
        assertEq(
            bridgeRouter.exposed_originAndNonce(origin, nonce),
            uint256((uint64(origin) << 32) | nonce)
        );
    }

    function test_renounceOwnership() public {
        address owner = bridgeRouter.owner();
        bridgeRouter.renounceOwnership();
        assertEq(bridgeRouter.owner(), owner);
    }
}
