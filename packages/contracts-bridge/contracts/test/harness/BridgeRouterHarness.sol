// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {BridgeRouter} from "../../BridgeRouter.sol";

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
}
