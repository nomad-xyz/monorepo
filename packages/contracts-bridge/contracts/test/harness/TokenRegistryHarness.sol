// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {TokenRegistry} from "../../TokenRegistry.sol";

contract TokenRegistryHarness is TokenRegistry {
    function exposed_setRepresentationToCanonical(
        uint32 _domain,
        bytes32 _id,
        address _representation
    ) external {
        _setRepresentationToCanonical(_domain, _id, _representation);
    }

    function exposed_setCanonicalToRepresentation(
        uint32 _domain,
        bytes32 _id,
        address _representation
    ) external {
        _setCanonicalToRepresentation(_domain, _id, _representation);
    }

    function exposed_deployToken(uint32 domain, bytes32 id)
        external
        returns (address _token)
    {
        return _deployToken(domain, id);
    }

    function exposed_defaultDetails(uint32 _domain, bytes32 _id)
        external
        pure
        returns (string memory, string memory)
    {
        return _defaultDetails(_domain, _id);
    }

    function exposed_localDomain() external view returns (uint32) {
        return _localDomain();
    }
}
