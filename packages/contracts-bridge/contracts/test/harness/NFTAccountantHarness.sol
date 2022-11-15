// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {AllowListNFTRecoveryAccountant} from "../../accountants/NFTAccountant.sol";

// NFT Recovery Harness
contract NFTRecoveryAccountantHarness is AllowListNFTRecoveryAccountant {
    constructor(address _bridgeRouter, address _fundsRecipient)
        AllowListNFTRecoveryAccountant(_bridgeRouter, _fundsRecipient)
    {}

    function exposed_setAffectedAmount(address asset, uint256 amount) external {
        totalAffected[asset] = amount;
    }

    function exposed_setCollectedAmount(address asset, uint256 amount)
        external
    {
        totalCollected[asset] = amount;
    }

    // bypass allowlist
    function exposed_recover(uint256 tokenId) external {
        _recover(tokenId);
    }
}
