// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;
pragma experimental ABIEncoderV2;

// ============ Internal Imports ============
import {BatchCall} from "./BatchCall.sol";
// ============ External Imports ============
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {XAppConnectionManager, TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

/*
Name: CallRouter
Author: Anna Carroll for Nomad

Description:
This contract executes arbitrary calls across chains
using Nomad for trust-minimized generalized message passing.
The contract has a single owner deployed on one chain,
which can dispatch calls to be executed on other chains.
This contract is perfect for cross-chain governance uses.
Governance actions can be dispatched to multiple chains
within the same proposal using one unified, easy-to-use interface.

Example Usage:
- Deploy CallRouter contracts on Ethereum, Polygon, Arbitrum and Optimism
- Set Owner to address of GovernorBravo contract on Ethereum
- Set OwnerDomain to Ethereum Domain
- On each non-ethereum chain, delegate Ownership of contracts to the CallRouter contract on that chain
- Now, the Ethereum GovernorBravo contract can dispatch calls to be executed
  on the contracts on remote chains (like Polygon, Arbitrum and Optimism)
  by calling into the Ethereum CallRouter's dispatchCalls function

Example Flow: for executing a call on Arbitrum, the call would be passed from Ethereum GovernorBravo -> Ethereum CallRouter -> Arbitrum CallRouter -> Arbitrum contracts
*/
contract CallRouter {
    // ============ Libraries ============

    using SafeMath for uint256;
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using BatchCall for bytes29;

    // ============== Enums ==============

    // The status of a batch of calls
    enum BatchStatus {
        Unknown, // 0
        Pending, // 1
        Complete // 2
    }

    // ============ Public Storage ============

    // the local entity empowered to call functions across chains, set to 0x0 on non-Owner chains
    address public owner;
    // domain of Owner chain -- for accepting incoming messages from Owner
    uint32 public ownerDomain;
    // call hash -> call status
    mapping(bytes32 => BatchStatus) public inboundCallBatches;
    // domain -> remote CallRouter contract address
    mapping(uint32 => bytes32) public remoteRouters;
    // xAppConnectionManager contract which stores Replica addresses
    XAppConnectionManager public xAppConnectionManager;

    // ============ Events ============

    /**
     * @notice Emitted when a batch of calls from the
     * Owner Router is received and ready for execution
     * @param batchHash A hash committing to the batch of calls to be executed
     */
    event BatchReceived(bytes32 indexed batchHash);

    /**
     * @notice Emitted when a batch of calls from the
     * Owner Router is executed
     * @param batchHash A hash committing to the batch of calls to be executed
     */
    event BatchExecuted(bytes32 indexed batchHash);

    /**
     * @notice Emitted a remote chain's CallRouter address is added, removed, or changed
     * @param domain the domain of the remote Router
     * @param previousRouter the previously registered router; 0 if router is being added
     * @param newRouter the new registered router; 0 if router is being removed
     */
    event SetRouter(
        uint32 indexed domain,
        bytes32 previousRouter,
        bytes32 newRouter
    );

    // ============ Modifiers ============

    modifier onlyReplica() {
        require(xAppConnectionManager.isReplica(msg.sender), "!replica");
        _;
    }

    modifier onlyRemoteOwner(uint32 _domain, bytes32 _address) {
        require(_isRemoteOwner(_domain, _address), "!remote owner");
        _;
    }

    modifier onlyLocalOwner() {
        require(
            msg.sender == owner || msg.sender == address(this),
            "!owner"
        );
        _;
    }

    // ============ Constructor ============

    constructor(
        uint32 _ownerDomain,
        address _owner,
        address _xAppConnectionManager
    ) {
        // set owner
        ownerDomain = _ownerDomain;
        owner = _owner;
        // set XAppConnectionManager
        setXAppConnectionManager(_xAppConnectionManager);
    }

    // ============ External Functions ============

    /**
     * @notice Handle Nomad messages
     * For all non-Owner chains to handle messages
     * sent from the Owner chain via Nomad.
     * Owner chain should never receive messages,
     * because non-Owner chains are not able to send them
     * @param _origin The domain (of the Owner Router)
     * @param _sender The message sender (must be the Owner Router)
     * @param _message The message
     */
    function handle(
        uint32 _origin,
        uint32, // _nonce (unused)
        bytes32 _sender,
        bytes memory _message
    ) external onlyReplica onlyRemoteOwner(_origin, _sender) {
        bytes29 _batchCall = _message.ref(0).tryAsBatch();
        if (_batchCall.notNull()) {
            _handleBatch(_batchCall);
        } else {
            require(false, "!valid message");
        }
    }

    /**
     * @notice Dispatch a set of local and remote calls
     * Local calls are executed immediately.
     * Remote calls are dispatched to the remote domain for processing and
     * execution.
     * @dev The contents of the _domains array at the same index
     * will determine the destination of messages in that _remoteCalls array.
     * As such, all messages in an array MUST have the same destination.
     * Missing destinations or too many will result in reverts.
     * @param _localCalls An array of local calls
     * @param _remoteCalls An array of arrays of remote calls
     */
    function dispatchCalls(
        BatchCall.Call[] calldata _localCalls,
        uint32[] calldata _domains,
        BatchCall.Call[][] calldata _remoteCalls
    ) external onlyLocalOwner {
        require(
            _domains.length == _remoteCalls.length,
            "!domains length matches calls length"
        );
        // _localCall loop
        for (uint256 i = 0; i < _localCalls.length; i++) {
            _callLocal(_localCalls[i]);
        }
        // remote calls loop
        for (uint256 i = 0; i < _remoteCalls.length; i++) {
            uint32 destination = _domains[i];
            _callRemote(destination, _remoteCalls[i]);
        }
    }

    /**
     * @notice execute a pending batch of messages on the local chain
     * @param _calls The array of calls to be executed locally
     */
    function executeCallBatch(
        BatchCall.Call[] calldata _calls
    ) external {
        bytes32 _batchHash = BatchCall.getBatchHash(_calls);
        require(
            inboundCallBatches[_batchHash] == BatchStatus.Pending,
            "!batch pending"
        );
        inboundCallBatches[_batchHash] = BatchStatus.Complete;
        for (uint256 i = 0; i < _calls.length; i++) {
            _callLocal(_calls[i]);
        }
        emit BatchExecuted(_batchHash);
    }

    /**
     * @notice Set the router address *locally only*
     * @dev For use in deploy to setup the router mapping locally
     * @param _domain The domain
     * @param _router The new router
     */
    function setRouterLocal(uint32 _domain, bytes32 _router)
        external
        onlyLocalOwner
    {
        // ignore local domain in router mapping
        require(!_isLocalDomain(_domain), "can't set local router");
        // store previous router in memory
        bytes32 _previousRouter = remoteRouters[_domain];
        // set router in mapping (add or change)
        remoteRouters[_domain] = _router;
        // emit event
        emit SetRouter(_domain, _previousRouter, _router);
    }

    /**
     * @notice Set the address of the XAppConnectionManager
     * @dev Domain/address validation helper
     * @param _xAppConnectionManager The address of the new xAppConnectionManager
     */
    function setXAppConnectionManager(address _xAppConnectionManager)
        public
        onlyLocalOwner
    {
        xAppConnectionManager = XAppConnectionManager(_xAppConnectionManager);
    }

    // ============ Internal Functions ============

    /**
     * @notice Handle message dispatching calls locally
     * @dev We considered requiring the batch was not previously known.
     *      However, this would prevent us from ever processing identical
     *      batches, which seems desirable in some cases.
     *      As a result, we simply set it to pending.
     * @param _msg The message
     */
    function _handleBatch(bytes29 _msg) internal {
        bytes32 _batchHash = _msg.batchHash();
        // prevent accidental SSTORE and extra event if already pending
        if (inboundCallBatches[_batchHash] == BatchStatus.Pending) return;
        inboundCallBatches[_batchHash] = BatchStatus.Pending;
        emit BatchReceived(_batchHash);
    }

    /**
     * @notice Dispatch calls on a remote chain via the remote Owner Router
     * @param _destination The domain of the remote chain
     * @param _calls The calls
     */
    function _callRemote(
        uint32 _destination,
        BatchCall.Call[] calldata _calls
    ) internal {
        // ensure that destination chain has enrolled router
        bytes32 _router = _mustHaveRouter(_destination);
        // format batch message
        bytes memory _msg = BatchCall.formatBatch(_calls);
        // dispatch call message using Nomad
        Home(xAppConnectionManager.home()).dispatch(
            _destination,
            _router,
            _msg
        );
    }

    /**
     * @notice Dispatch call locally
     * @param _call The call
     * @return _ret
     */
    function _callLocal(BatchCall.Call memory _call)
        internal
        returns (bytes memory _ret)
    {
        address _toContract = TypeCasts.bytes32ToAddress(_call.to);
        // attempt to dispatch using low-level call
        bool _success;
        (_success, _ret) = _toContract.call(_call.data);
        // revert if the call failed
        require(_success, "call failed");
    }

    /**
     * @notice Determine if a given domain and address is the Owner Router
     * @param _domain The domain
     * @param _address The address of the domain's router
     * @return _ret True if the given domain/address is the
     * Owner Router.
     */
    function _isRemoteOwner(uint32 _domain, bytes32 _address)
        internal
        view
        returns (bool)
    {
        return _domain == ownerDomain && _address == remoteRouters[_domain];
    }

    /**
     * @notice Determine if a given domain is the local domain
     * @param _domain The domain
     * @return _ret - True if the given domain is the local domain
     */
    function _isLocalDomain(uint32 _domain) internal view returns (bool) {
        return _domain == xAppConnectionManager.localDomain();
    }

    /**
     * @notice Require that a domain has a router and returns the router
     * @param _domain The domain
     * @return _router - The domain's router
     */
    function _mustHaveRouter(uint32 _domain)
    internal
    view
    returns (bytes32 _router)
    {
        _router = remoteRouters[_domain];
        require(_router != bytes32(0), "!router");
    }
}
