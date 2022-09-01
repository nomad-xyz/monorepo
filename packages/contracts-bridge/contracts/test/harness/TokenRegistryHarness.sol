// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {TokenRegistry} from "../../TokenRegistry.sol";

contract TokenRegistryHarness is TokenRegistry {
    function exposed_deployToken(uint32 domain, bytes32 id)
        external
        returns (address _token)
    {
        return _deployToken(domain, id);
    }
}
