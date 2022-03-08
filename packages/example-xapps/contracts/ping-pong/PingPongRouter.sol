// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

// ============ External Imports ============
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
// ============ Internal Imports ============
import {PingPongMessage} from "./PingPongMessage.sol";
import {Router} from "@nomad-xyz/contracts-router/contracts/Router.sol";
import {XAppConnectionClient} from "@nomad-xyz/contracts-router/contracts/XAppConnectionClient.sol";

/*
============ PingPong xApp ============
The PingPong xApp is capable of initiating PingPong "matches" between two chains.
A match consists of "volleys" sent back-and-forth between the two chains via Nomad.

The first volley in a match is always a Ping volley.
When a Router receives a Ping volley, it returns a Pong.
When a Router receives a Pong volley, it returns a Ping.

The Routers keep track of the number of volleys in a given match,
and emit events for each Sent and Received volley so that spectators can watch.
*/
contract PingPongRouter is Router {
    // ============ Libraries ============

    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using PingPongMessage for bytes29;

    // ============ Mutable State ============
    uint32 nextMatch;

    // ============ Events ============

    event Received(
        uint32 indexed domain,
        uint32 indexed matchId,
        uint256 count,
        bool isPing
    );
    event Sent(
        uint32 indexed domain,
        uint32 indexed matchId,
        uint256 count,
        bool isPing
    );

    // ============ Constructor ============
    constructor(address _xAppConnectionManager) {
        require(false, "example xApp, do not deploy");

        __XAppConnectionClient_initialize(_xAppConnectionManager);
    }

    // ============ Handle message functions ============

    /**
     * @notice Handle "volleys" sent via Nomad from other remote PingPong Routers
     * @param _origin The domain the message is coming from
     * @param _sender The address the message is coming from
     * @param _message The message in the form of raw bytes
     */
    function handle(
        uint32 _origin,
        uint32, // nonce
        bytes32 _sender,
        bytes memory _message
    ) external override onlyReplica onlyRemoteRouter(_origin, _sender) {
        bytes29 _msg = _message.ref(0);
        if (_msg.isPing()) {
            _handlePing(_origin, _msg);
        } else if (_msg.isPong()) {
            _handlePong(_origin, _msg);
        } else {
            // if _message doesn't match any valid actions, revert
            require(false, "!valid action");
        }
    }

    /**
     * @notice Handle a Ping volley
     * @param _origin The domain that sent the volley
     * @param _message The message in the form of raw bytes
     */
    function _handlePing(uint32 _origin, bytes29 _message) internal {
        bool _isPing = true;
        _handle(_origin, _isPing, _message);
    }

    /**
     * @notice Handle a Pong volley
     * @param _origin The domain that sent the volley
     * @param _message The message in the form of raw bytes
     */
    function _handlePong(uint32 _origin, bytes29 _message) internal {
        bool _isPing = false;
        _handle(_origin, _isPing, _message);
    }

    /**
     * @notice Upon receiving a volley, emit an event, increment the count and return a the opposite volley
     * @param _origin The domain that sent the volley
     * @param _isPing True if the volley received is a Ping, false if it is a Pong
     * @param _message The message in the form of raw bytes
     */
    function _handle(
        uint32 _origin,
        bool _isPing,
        bytes29 _message
    ) internal {
        // get the volley count for this game
        uint256 _count = _message.count();
        uint32 _match = _message.matchId();
        // emit a Received event
        emit Received(_origin, _match, _count, _isPing);
        // send the opposite volley back
        _send(_origin, !_isPing, _match, _count + 1);
    }

    // ============ Dispatch message functions ============

    /**
     * @notice Initiate a PingPong match with the destination domain
     * by sending the first Ping volley.
     * @param _destinationDomain The domain to initiate the match with
     */
    function initiatePingPongMatch(uint32 _destinationDomain) external {
        // the PingPong match always begins with a Ping volley
        bool _isPing = true;
        // increment match counter
        uint32 _match = nextMatch;
        nextMatch = _match + 1;
        // send the first volley to the destination domain
        _send(_destinationDomain, _isPing, _match, 0);
    }

    /**
     * @notice Send a Ping or Pong volley to the destination domain
     * @param _destinationDomain The domain to send the volley to
     * @param _isPing True if the volley to send is a Ping, false if it is a Pong
     * @param _count The number of volleys in this match
     */
    function _send(
        uint32 _destinationDomain,
        bool _isPing,
        uint32 _match,
        uint256 _count
    ) internal {
        // get the xApp Router at the destinationDomain
        bytes32 _remoteRouterAddress = _mustHaveRemote(_destinationDomain);
        // format the ping message
        bytes memory _message = _isPing
            ? PingPongMessage.formatPing(_match, _count)
            : PingPongMessage.formatPong(_match, _count);
        // send the message to the xApp Router
        (_home()).dispatch(_destinationDomain, _remoteRouterAddress, _message);
        // emit a Sent event
        emit Sent(_destinationDomain, _match, _count, _isPing);
    }
}
