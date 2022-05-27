// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import "../NomadBase.sol";

contract TestNomadBase is NomadBase {
    constructor(uint32 _localDomain, address _updater) NomadBase(_localDomain) {
        __NomadBase_initialize(_updater);
    }

    function setUpdater(address _updater) external {
        updater = _updater;
    }

    function testIsUpdaterSignature(
        bytes32 _oldRoot,
        bytes32 _newRoot,
        bytes memory _signature
    ) external view returns (bool) {
        return _isUpdaterSignature(_oldRoot, _newRoot, _signature);
    }

    /// @notice Hash of Home's domain concatenated with "NOMAD"
    function homeDomainHash() public view override returns (bytes32) {
        return keccak256(abi.encodePacked(localDomain, "NOMAD"));
    }

    function _fail() internal override {
        _setFailed();
    }
}
