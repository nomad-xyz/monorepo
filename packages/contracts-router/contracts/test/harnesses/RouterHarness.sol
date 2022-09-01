// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {Router} from "../../Router.sol";
import "forge-std/console2.sol";

contract RouterHarness is Router {
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
    ) external override {}
}
