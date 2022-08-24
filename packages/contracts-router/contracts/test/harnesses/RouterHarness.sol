// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {Router} from "../../Router.sol";
import "forge-std/console2.sol";

contract RouterHarness is Router {
    struct HandledMessage {
        uint32 origin;
        uint32 nonce;
        bytes32 sender;
        bytes message;
    }

    HandledMessage[] public handledMessages;

    function exposed__XAppConnectionClient_initialize(
        address _xAppConnectionManager
    ) external {
        __XAppConnectionClient_initialize(_xAppConnectionManager);
    }

    function exposed_mustHaveRemote(uint32 domain)
        external
        view
        returns (bytes32)
    {
        return _mustHaveRemote(domain);
    }

    function exposed_isRemoteRouter(uint32 domain, bytes32 router)
        external
        view
        returns (bool)
    {
        return _isRemoteRouter(domain, router);
    }

    function handle(
        uint32 origin,
        uint32 nonce,
        bytes32 sender,
        bytes memory message
    ) external override {
        console2.log("====Router Received Message====");
        console2.log("origin:", origin);
        console2.log("nonce:", nonce);
        console2.log("sender");
        console2.logBytes32(sender);
        console2.log("message");
        console2.logBytes(message);
        console2.log("");
        handledMessages.push(HandledMessage(origin, nonce, sender, message));
    }
}
