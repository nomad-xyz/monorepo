// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

interface IEventAccountant {
    function record(
        address _asset,
        address _user,
        uint256 _amount
    ) external;

    function affectedAssets()
        external
        pure
        returns (address payable[14] memory);

    function isAffectedAsset(address _asset) external view returns (bool);
}
