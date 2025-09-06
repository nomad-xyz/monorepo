// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// ============ External Imports ============
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
// ============ Internal Imports ============
import {DABridgeMessage} from "./DABridgeMessage.sol";
import {XAppConnectionClient} from "@nomad-xyz/contracts-router/contracts/XAppConnectionClient.sol";
import {Router} from "@nomad-xyz/contracts-router/contracts/Router.sol";
import {Version0} from "@nomad-xyz/contracts-core/contracts/Version0.sol";

/**
 * @title DABridgeRouter
 */
contract DABridgeRouter is Version0, Router {
    // ============ Libraries ============

    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using DABridgeMessage for bytes29;

    // ============ Public Storage ============

    mapping(uint32 => bytes32) public roots;
    uint32 private _availDomain;

    // ============ Upgrade Gap ============

    // gap for upgrade safety
    uint256[50] private __GAP;

    // ============ Events ============

    /**
     * @notice emitted when a new data root is received
     * @param originAndNonce Domain where the transfer originated and the
     *        unique identifier for the message from origin to destination,
     *        combined in a single field ((origin << 32) & nonce)
     * @param blockNumber for data root
     * @param root data root
     */
    event DataRootReceived(
        uint64 indexed originAndNonce,
        uint32 indexed blockNumber,
        bytes32 root
    );

    // ============ Initializer ============

    function initialize(address _xAppConnectionManager, uint32 availDomain)
        public
        initializer
    {
        __XAppConnectionClient_initialize(_xAppConnectionManager);
        _availDomain = availDomain;
    }

    // ============ Handle message functions ============

    /**
     * @notice Receive messages sent via Nomad from other remote xApp Routers;
     * parse the contents of the message and enact the message's effects on the local chain
     * @dev Called by an Nomad Replica contract while processing a message sent via Nomad
     * @param _origin The domain the message is coming from
     * @param _nonce The unique identifier for the message from origin to destination
     * @param _sender The address the message is coming from
     * @param _message The message in the form of raw bytes
     */
    function handle(
        uint32 _origin,
        uint32 _nonce,
        bytes32 _sender,
        bytes memory _message
    ) external override onlyReplica onlyRemoteRouter(_origin, _sender) {
        require(_origin == _availDomain, "!valid domain");
        bytes29 _view = _message.ref(0).getTypedView();
        if (_view.isValidDataRootBatch()) {
            _handleDataRoot(_origin, _nonce, _view);
        } else {
            revert("!valid message");
        }
    }

    /**
     * @notice Once the Router has parsed a message in the handle function,
     * call this internal function to parse and store the `blockNumber`
     * and `root` from the message.
     * @param _origin The domain the message is coming from
     * @param _nonce The unique identifier for the message from origin to destination
     * @param _message The message in the form of raw bytes
     */
    function _handleDataRoot(
        uint32 _origin,
        uint32 _nonce,
        bytes29 _message
    ) internal {
        DABridgeMessage.DataRootBatchItem[] memory batch = _message
            .dataRootBatch();
        for (uint256 i = 0; i < batch.length; i++) {
            bytes32 root = batch[i].dataRoot;
            uint32 blockNumber = batch[i].blockNumber;
            assert(roots[blockNumber] == 0);

            roots[blockNumber] = root;
            emit DataRootReceived(
                (uint64(_origin) << 32) | uint64(_nonce),
                blockNumber,
                root
            );
        }
    }

    // ============ Internal: Utils ============

    /**
     * @notice Internal utility function that combines
     *         `_origin` and `_nonce`.
     * @dev Both origin and nonce should be less than 2^32 - 1
     * @param _origin Domain of chain where the transfer originated
     * @param _nonce The unique identifier for the message from origin to
              destination
     * @return Returns (`_origin` << 32) & `_nonce`
     */
    function _originAndNonce(uint32 _origin, uint32 _nonce)
        internal
        pure
        returns (uint64)
    {
        return (uint64(_origin) << 32) | _nonce;
    }
}
