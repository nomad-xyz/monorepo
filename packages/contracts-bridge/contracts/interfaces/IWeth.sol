// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

interface IWeth {
    function deposit() external payable;

    function approve(address _who, uint256 _wad) external;
}
