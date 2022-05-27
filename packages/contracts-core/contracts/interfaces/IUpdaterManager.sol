// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

interface IUpdaterManager {
    function slashUpdater(address payable _reporter) external;

    function updater() external view returns (address);
}
