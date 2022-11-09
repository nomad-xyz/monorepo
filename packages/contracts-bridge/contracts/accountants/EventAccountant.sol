// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// ============ Internal Imports ============
import {IEventAccountant} from "../interfaces/IEventAccountant.sol";
// ============ External Imports ============
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title EventAccountant
abstract contract EventAccountant is IEventAccountant {
    /// @notice the address of the bridgeRouter that is allowed to record here
    address public immutable bridgeRouter;

    /// @notice token address => amount of affected tokens
    mapping(address => uint256) public totalAffected;

    // ============ Upgrade Gap ============

    // gap for upgrade safety
    uint256[49] private __GAP;

    /// ============ Constructor ============
    constructor(address _bridgeRouter) {
        // configure bridgeRouter
        bridgeRouter = _bridgeRouter;
    }

    /// ============ Initializer ============
    function __EventAccountant_init() internal {
        // set affected token amounts in mapping
        totalAffected[
            0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
        ] = 102_829_072_399;
        totalAffected[
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
        ] = 22_868_595_330_591_440_628_473;
        totalAffected[
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
        ] = 87_250_743_982_016;
        totalAffected[
            0x853d955aCEf822Db058eb8505911ED77F175b99e
        ] = 6_683_295_726_936_365_174_269_341;
        totalAffected[
            0xdAC17F958D2ee523a2206206994597C13D831ec7
        ] = 8_626_248_974_867;
        totalAffected[
            0x6B175474E89094C44Da98b954EedeAC495271d0F
        ] = 4_533_681_025_522_997_592_670_853;
        totalAffected[
            0xD417144312DbF50465b1C641d016962017Ef6240
        ] = 113_403_891_487_223_872_600_000_000;
        totalAffected[
            0x3d6F0DEa3AC3C607B3998e6Ce14b6350721752d9
        ] = 736_498_134_676_753_019_950_000;
        totalAffected[
            0x40EB746DEE876aC1E78697b7Ca85142D178A1Fc8
        ] = 516_231_512_011_105_000_000_000_000;
        totalAffected[
            0xf1a91C7d44768070F711c68f33A7CA25c8D30268
        ] = 7_221_941_652_919_222_278_900_000;
        totalAffected[
            0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0
        ] = 106_595_122_254_787_950_000_000;
        totalAffected[
            0x3431F91b3a388115F00C5Ba9FdB899851D005Fb5
        ] = 58_808_241_561_215_147_129_400_000;
        totalAffected[
            0xE5097D9baeAFB89f9bcB78C9290d545dB5f9e9CB
        ] = 11_802_082_723_892_000_000_000_000;
        totalAffected[
            0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871
        ] = 322_589_324_798_359_784_835_428;
    }

    /**
     * @notice Returns true if the asset was affected, false otherwise
     * @param _asset The asset to be checked
     * @return True if the asset is in the affected list. False otherwise
     */
    function isAffectedAsset(address _asset)
        public
        view
        override
        returns (bool)
    {
        return totalAffected[_asset] != 0;
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

    /**
     * @notice record an attempted process for an affected asset
     * @param _asset  The asset
     * @param _user   The recipient
     * @param _amount The amount
     */
    function record(
        address _asset,
        address _user,
        uint256 _amount
    ) external override {
        require(msg.sender == bridgeRouter, "only BridgeRouter");
        _record(_asset, _user, _amount);
    }

    /**
     * @notice Internal logic for recording an attempted process for an
     *         affected asset
     * @dev Override this method to implement specific accounting logic.
     * @param _asset  The asset
     * @param _user   The recipient
     * @param _amount The amount
     */
    function _record(
        address _asset,
        address _user,
        uint256 _amount
    ) internal virtual;
}
