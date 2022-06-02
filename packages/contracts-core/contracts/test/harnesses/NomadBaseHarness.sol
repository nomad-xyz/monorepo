// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {NomadBase} from "../../NomadBase.sol";

contract NomadBaseHarness is NomadBase {
    uint32 domain;

    constructor(uint32 _domain) NomadBase(_domain) {
        domain = _domain;
    }

    function homeDomainHash() public view override returns (bytes32) {
        return _homeDomainHash(domain);
    }

    function isUpdaterSignature(
        bytes32 oldRoot,
        bytes32 newRoot,
        bytes memory signature
    ) external view returns (bool) {
        return _isUpdaterSignature(oldRoot, newRoot, signature);
    }

    function initialize(address updater) public {
        __NomadBase_initialize(updater);
    }
}
