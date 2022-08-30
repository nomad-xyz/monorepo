// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./NomadProtocol.sol";

interface INomadProtocol {
    struct ProtocolConfig {
        uint256 recoveryTimelock;
        uint256 optimisticSeconds;
        uint32 localDomain;
        address updater;
        address watcher;
        address recoveryManager;
    }

    function printProtocolAttributes() external;

    function relinquishControlToLocalGov() external;
}

interface IMultiNomadProtocol {
    function setUp() external;

    function setUpProtocol(INomadProtocol.ProtocolConfig memory)
        external
        returns (NomadProtocol);

    function connectRemoteToLocal(uint32 homeDomain, uint32 remoteDomain)
        external;

    function setGovernorChain(uint32 domain)
        external
        returns (address governor);

    function setUpActors() external;

    function getEnv() external;
}
