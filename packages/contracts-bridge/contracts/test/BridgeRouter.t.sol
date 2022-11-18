// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// Libraries
import {BridgeMessage} from "packages/contracts-bridge/contracts/BridgeMessage.sol";
import {TypeCasts} from "packages/contracts-core/contracts/libs/TypeCasts.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

// Contracts
import {BridgeToken} from "packages/contracts-bridge/contracts/BridgeToken.sol";
import {BridgeRouterBaseTest} from "./BridgeRouterBase.t.sol";

contract BridgeRouterTest is BridgeRouterBaseTest {
    using TypeCasts for bytes32;
    using TypeCasts for address payable;
    using TypeCasts for address;
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using BridgeMessage for bytes29;

    event Receive(
        uint64 indexed originAndNonce,
        address indexed token,
        address indexed recipient,
        address liquidityProvider,
        uint256 amount
    );

    function test_giveTokensLocal() public {
        uint32 origin = remoteDomain;
        uint32 nonce = 12;
        address recipient = address(0xBEEF);
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "adsf";
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            recipient.addressToBytes32(),
            tokenAmount,
            tokenDetailsHash
        );
        bytes memory tokenId = abi.encodePacked(
            localDomain,
            address(localToken).addressToBytes32()
        );
        localToken.mint(address(bridgeRouter), tokenAmount);
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Transfer(address(bridgeRouter), recipient, tokenAmount);
        vm.expectEmit(true, true, true, true, address(bridgeRouter));
        emit Receive(
            12884901888012,
            address(localToken),
            recipient,
            address(0),
            tokenAmount
        );
        bridgeRouter.exposed_giveTokens(
            origin,
            nonce,
            tokenId,
            action,
            recipient
        );
        assertEq(localToken.balanceOf(recipient), tokenAmount);
    }

    function test_giveTokensRemoteExistingRepresentationSucceeds() public {
        uint32 origin = remoteDomain;
        uint32 nonce = 12;
        address recipient = address(0xBEEF);
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "adsf";
        address token = remoteTokenLocalAddress;
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            recipient.addressToBytes32(),
            tokenAmount,
            tokenDetailsHash
        );
        bytes memory tokenId = abi.encodePacked(
            localDomain,
            token.addressToBytes32()
        );
        vm.expectEmit(true, true, false, true, token);
        // It mints new representations
        emit Transfer(address(0), recipient, tokenAmount);
        vm.expectEmit(true, true, true, true);
        emit Receive(12884901888012, token, recipient, address(0), tokenAmount);
        bridgeRouter.exposed_giveTokens(
            origin,
            nonce,
            tokenId,
            action,
            recipient
        );
        assertEq(remoteToken.balanceOf(recipient), tokenAmount);
        assertEq(BridgeToken(token).detailsHash(), tokenDetailsHash);
    }

    function test_giveTokensRemoteNewRepresentationSucceeds() public {
        uint32 origin = remoteDomain;
        uint32 nonce = 12;
        address recipient = address(0xBEEF);
        uint256 tokenAmount = 100;
        bytes32 tokenDetailsHash = "adsf";
        bytes32 token = "remote token addr";
        bytes memory action = abi.encodePacked(
            BridgeMessage.Types.Transfer,
            recipient.addressToBytes32(),
            tokenAmount,
            tokenDetailsHash
        );
        bytes memory tokenId = abi.encodePacked(remoteDomain, token);
        // As the token has no representation on the local domain
        // bridgeRouter will ask TokenRegistry to deploy a new BridgeToken representation
        // The address of the deployment is determenistic because it uses CREATE
        address tokenRepresentation = computeCreateAddress(
            address(tokenRegistry),
            // we use nonce = 2, because this is the second contract deployed by
            // tokenRegistry
            vm.getNonce(address(tokenRegistry))
        );
        vm.expectEmit(true, true, false, true);
        // It mints new representation tokens
        emit Transfer(address(0), recipient, tokenAmount);
        vm.expectEmit(true, true, true, true);
        emit Receive(
            12884901888012,
            tokenRepresentation,
            recipient,
            address(0),
            tokenAmount
        );
        bridgeRouter.exposed_giveTokens(
            origin,
            nonce,
            tokenId,
            action,
            recipient
        );
        assertEq(
            BridgeToken(tokenRepresentation).balanceOf(recipient),
            tokenAmount
        );
        assertEq(
            BridgeToken(tokenRepresentation).detailsHash(),
            tokenDetailsHash
        );
    }
}
