// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {BridgeRouter, EthereumBridgeRouter} from "../../BridgeRouter.sol";
import {BridgeMessage} from "../../BridgeMessage.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

contract BridgeRouterHarness is BridgeRouter {
    function takeTokens(address token, uint256 amount)
        external
        returns (bytes29 _tokenId, bytes32 _detailsHash)
    {
        return _takeTokens(token, amount);
    }

    function sendTransferMessage(
        uint32 dest,
        bytes29 tokenId,
        bytes29 action
    ) external {
        _sendTransferMessage(dest, tokenId, action);
    }

    function giveLocal(
        address token,
        uint256 amount,
        address recipient
    ) external {
        _giveLocal(token, amount, recipient);
    }
}

contract EthereumBridgeRouterHarness is EthereumBridgeRouter {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    constructor(address _accountant) EthereumBridgeRouter(_accountant) {}

    function takeTokens(address token, uint256 amount)
        external
        returns (bytes29 _tokenId, bytes32 _detailsHash)
    {
        return _takeTokens(token, amount);
    }

    function sendTransferMessage(
        uint32 dest,
        bytes29 tokenId,
        bytes29 action
    ) external {
        _sendTransferMessage(dest, tokenId, action);
    }

    function giveLocal(
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
}
