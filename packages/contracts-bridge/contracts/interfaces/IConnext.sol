// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

interface IConnext {
    function reconcile(
        bytes32 transferId,
        uint256 amount,
        bytes32 canonicalId,
        uint32 canonicalDomain,
        address localToken
    ) external;
}
