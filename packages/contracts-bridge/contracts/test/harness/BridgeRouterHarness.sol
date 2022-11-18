// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {BridgeRouter, EthereumBridgeRouter} from "../../BridgeRouter.sol";
import {BridgeMessage} from "../../BridgeMessage.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

contract BridgeRouterHarness is BridgeRouter {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    function exposed_takeTokens(address token, uint256 amount)
        external
        returns (bytes29 _tokenId, bytes32 _detailsHash)
    {
        return _takeTokens(token, amount);
    }

    function exposed_sendTransferMessage(
        uint32 dest,
        bytes memory tokenId,
        bytes memory action
    ) external {
        _sendTransferMessage(
            dest,
            tokenId.ref(uint40(BridgeMessage.Types.TokenId)),
            action.ref(uint40(BridgeMessage.Types.Transfer))
        );
    }

    function exposed_giveLocal(
        address token,
        uint256 amount,
        address recipient
    ) external {
        _giveLocal(token, amount, recipient);
    }

    function exposed_handleTransferToHook(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action
    ) external {
        bytes29 tokenIdView = tokenId.ref(uint40(BridgeMessage.Types.TokenId));
        bytes29 actionView = action.ref(
            uint40(BridgeMessage.Types.TransferToHook)
        );
        _handleTransferToHook(origin, nonce, tokenIdView, actionView);
    }

    function exposed_handleTransfer(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action
    ) external {
        bytes29 tokenIdView = tokenId.ref(uint40(BridgeMessage.Types.TokenId));
        bytes29 actionView = action.ref(uint40(BridgeMessage.Types.Transfer));
        _handleTransfer(origin, nonce, tokenIdView, actionView);
    }

    function exposed_giveTokens(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action,
        address recipient
    ) external returns (address) {
        bytes29 tokenIdView = tokenId.ref(uint40(BridgeMessage.Types.TokenId));
        bytes29 actionView = action.ref(
            uint40(BridgeMessage.Types.TransferToHook)
        );
        return _giveTokens(origin, nonce, tokenIdView, actionView, recipient);
    }

    function exposed_dust(address account) external {
        _dust(account);
    }

    function exposed_originAndNonce(uint32 origin, uint32 nonce)
        external
        pure
        returns (uint64)
    {
        return _originAndNonce(origin, nonce);
    }
}

contract EthereumBridgeRouterHarness is EthereumBridgeRouter {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    constructor(address _accountant) EthereumBridgeRouter(_accountant) {}

    function exposed_takeTokens(address token, uint256 amount)
        external
        returns (bytes29 _tokenId, bytes32 _detailsHash)
    {
        return _takeTokens(token, amount);
    }

    function exposed_sendTransferMessage(
        uint32 dest,
        bytes memory tokenId,
        bytes memory action
    ) external {
        _sendTransferMessage(
            dest,
            tokenId.ref(uint40(BridgeMessage.Types.TokenId)),
            action.ref(uint40(BridgeMessage.Types.Transfer))
        );
    }

    function exposed_giveLocal(
        address token,
        uint256 amount,
        address recipient
    ) external {
        _giveLocal(token, amount, recipient);
    }

    function exposed_handleTransferToHook(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action
    ) external {
        bytes29 tokenIdView = tokenId.ref(uint40(BridgeMessage.Types.TokenId));
        bytes29 actionView = action.ref(
            uint40(BridgeMessage.Types.TransferToHook)
        );
        _handleTransferToHook(origin, nonce, tokenIdView, actionView);
    }

    function exposed_handleTransfer(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action
    ) external {
        bytes29 tokenIdView = tokenId.ref(uint40(BridgeMessage.Types.TokenId));
        bytes29 actionView = action.ref(uint40(BridgeMessage.Types.Transfer));
        _handleTransfer(origin, nonce, tokenIdView, actionView);
    }

    function exposed_giveTokens(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action,
        address recipient
    ) external returns (address) {
        bytes29 tokenIdView = tokenId.ref(uint40(BridgeMessage.Types.TokenId));
        bytes29 actionView = action.ref(
            uint40(BridgeMessage.Types.TransferToHook)
        );
        return _giveTokens(origin, nonce, tokenIdView, actionView, recipient);
    }

    function exposed_dust(address account) external {
        _dust(account);
    }

    function exposed_originAndNonce(uint32 origin, uint32 nonce)
        external
        pure
        returns (uint64)
    {
        return _originAndNonce(origin, nonce);
    }
}
