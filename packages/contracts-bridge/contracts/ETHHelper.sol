// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// ============ Internal Imports ============
import {BridgeRouter} from "./BridgeRouter.sol";
import {IWeth} from "./interfaces/IWeth.sol";
// ============ External Imports ============
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

contract ETHHelper {
    // ============ Immutables ============

    // wrapped Ether contract
    IWeth public immutable weth;
    // bridge router contract
    BridgeRouter public immutable bridge;

    // ======== Events =========

    /**
     * @notice emitted when Ether is sent from this domain to another domain
     * @param from the address sending tokens
     */
    event Send(address indexed from);

    // ============ Constructor ============

    constructor(address _weth, address payable _bridge) {
        weth = IWeth(_weth);
        bridge = BridgeRouter(_bridge);
        IWeth(_weth).approve(_bridge, uint256(-1));
    }

    // ============ External Functions ============

    /**
     * @notice Sends ETH over the Nomad Bridge. Sends to a full-width Nomad
     * identifer on the other side.
     * @dev As with all bridges, improper use may result in loss of funds.
     * @param _domain The domain to send funds to.
     * @param _to The 32-byte identifier of the recipient
     */
    function sendTo(
        uint32 _domain,
        bytes32 _to,
        bool /*_enableFast - deprecated field, left argument for backwards compatibility */
    ) public payable {
        // wrap ETH to WETH
        weth.deposit{value: msg.value}();
        // send WETH via bridge
        bridge.send(address(weth), msg.value, _domain, _to, false);
        // emit event indicating the original sender of tokens
        emit Send(msg.sender);
    }

    /**
     * @notice Sends ETH over the Nomad Bridge. Sends to the same address on
     * the other side.
     * @dev WARNING: This function should only be used when sending TO an
     * EVM-like domain. As with all bridges, improper use may result in loss of
     * funds.
     * @param _domain The domain to send funds to
     */
    function send(
        uint32 _domain,
        bool /*_enableFast - deprecated field, left argument for backwards compatibility */
    ) external payable {
        sendTo(_domain, TypeCasts.addressToBytes32(msg.sender), false);
    }

    /**
     * @notice Sends ETH over the Nomad Bridge. Sends to a specified EVM
     * address on the other side.
     * @dev This function should only be used when sending TO an EVM-like
     * domain. As with all bridges, improper use may result in loss of funds
     * @param _domain The domain to send funds to.
     * @param _to The EVM address of the recipient
     */
    function sendToEVMLike(
        uint32 _domain,
        address _to,
        bool /*_enableFast - deprecated field, left argument for backwards compatibility */
    ) external payable {
        sendTo(_domain, TypeCasts.addressToBytes32(_to), false);
    }
}
