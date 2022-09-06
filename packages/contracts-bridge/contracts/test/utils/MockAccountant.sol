// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {IEventAccountant} from "../../interfaces/IEventAccountant.sol";

contract MockAccountant is IEventAccountant {
    event MockAcctCalled(
        address indexed _asset,
        address indexed _user,
        uint256 _amount
    );

    function record(
        address _asset,
        address _user,
        uint256 _amount
    ) external override {
        emit MockAcctCalled(_asset, _user, _amount);
    }

    // Below are reproduced due to laziness

    /**
     * @notice Returns true if the asset was affected, false otherwise
     * @param _asset The asset to be checked
     * @return True if the asset is in the affected list. False otherwise
     */
    function isAffectedAsset(address _asset)
        public
        pure
        override
        returns (bool)
    {
        address payable[14] memory _affected = affectedAssets();
        for (uint256 i = 0; i < _affected.length; i++) {
            if (_asset == _affected[i]) return true;
        }
        return false;
    }

    /**
     * @notice Returns a list of affected assets
     */
    function affectedAssets()
        public
        pure
        override
        returns (address payable[14] memory)
    {
        return [
            0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599,
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            0x853d955aCEf822Db058eb8505911ED77F175b99e,
            0xdAC17F958D2ee523a2206206994597C13D831ec7,
            0x6B175474E89094C44Da98b954EedeAC495271d0F,
            0xD417144312DbF50465b1C641d016962017Ef6240,
            0x3d6F0DEa3AC3C607B3998e6Ce14b6350721752d9,
            0x40EB746DEE876aC1E78697b7Ca85142D178A1Fc8,
            0xf1a91C7d44768070F711c68f33A7CA25c8D30268,
            0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0,
            0x3431F91b3a388115F00C5Ba9FdB899851D005Fb5,
            0xE5097D9baeAFB89f9bcB78C9290d545dB5f9e9CB,
            0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871
        ];
    }
}
