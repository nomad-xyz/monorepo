// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {NomadBase} from "../../NomadBase.sol";

contract NomadBaseHarness is NomadBase {
    uint32 domain = 1000;

    constructor(uint32 domain) NomadBase(domain) {}

    function _fail() internal override {}

    function homeDomainHash() public view override returns (bytes32) {
        return _homeDomainHash(domain);
    }

    function isUpdaterSignature(
        bytes32 oldRoot,
        bytes32 newRoot,
        bytes memory signature
    ) external returns (bool) {
        return _isUpdaterSignature(oldRoot, newRoot, signature);
    }
}
