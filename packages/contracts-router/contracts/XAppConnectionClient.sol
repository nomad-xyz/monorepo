// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// ============ External Imports ============
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract XAppConnectionClient is OwnableUpgradeable {
    // ============ Mutable Storage ============

    XAppConnectionManager public xAppConnectionManager;
    uint256[49] private __GAP; // gap for upgrade safety

    // ============ Modifiers ============

    /**
     * @notice Only accept messages from an Nomad Replica contract
     */
    modifier onlyReplica() {
        require(_isReplica(msg.sender), "!replica");
        _;
    }

    // ======== Initializer =========

    function __XAppConnectionClient_initialize(address _xAppConnectionManager)
        internal
        initializer
    {
        xAppConnectionManager = XAppConnectionManager(_xAppConnectionManager);
        __Ownable_init();
    }

    // ============ External functions ============

    /**
     * @notice Modify the contract the xApp uses to validate Replica contracts
     * @param _xAppConnectionManager The address of the xAppConnectionManager contract
     */
    function setXAppConnectionManager(address _xAppConnectionManager)
        external
        onlyOwner
    {
        xAppConnectionManager = XAppConnectionManager(_xAppConnectionManager);
    }

    // ============ Internal functions ============

    /**
     * @notice Get the local Home contract from the xAppConnectionManager
     * @return The local Home contract
     */
    function _home() internal view returns (Home) {
        return xAppConnectionManager.home();
    }

    /**
     * @notice Determine whether _potentialReplica is an enrolled Replica from the xAppConnectionManager
     * @param _potentialReplica The candidate to be tested. Violently.
     * @return True if _potentialReplica is an enrolled Replica
     */
    function _isReplica(address _potentialReplica)
        internal
        view
        returns (bool)
    {
        return xAppConnectionManager.isReplica(_potentialReplica);
    }

    /**
     * @notice Get the local domain from the xAppConnectionManager
     * @return The local domain
     */
    function _localDomain() internal view virtual returns (uint32) {
        return xAppConnectionManager.localDomain();
    }
}
