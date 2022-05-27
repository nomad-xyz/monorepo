// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;
pragma experimental ABIEncoderV2;

import "../governance/GovernanceRouter.sol";
import {TypeCasts} from "../XAppConnectionManager.sol";

contract TestGovernanceRouter is GovernanceRouter {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using GovernanceMessage for bytes29;

    constructor(uint32 _localDomain, uint256 _recoveryTimelock)
        GovernanceRouter(_localDomain, 50)
    {} // solhint-disable-line no-empty-blocks

    function testSetRouterGlobal(uint32 _domain, bytes32 _router) external {
        _setRouterGlobal(_domain, _router);
    }

    function setRouterAddress(uint32 _domain, address _router) external {
        _setRouter(_domain, TypeCasts.addressToBytes32(_router));
    }

    function containsDomain(uint32 _domain) external view returns (bool) {
        for (uint256 i = 0; i < domains.length; i++) {
            if (domains[i] == _domain) return true;
        }

        return false;
    }

    function testSetBatch(GovernanceMessage.Call[] memory _calls) external {
        bytes32 _batchHash = GovernanceMessage.getBatchHash(_calls);
        inboundCallBatches[_batchHash] = BatchStatus.Pending;
    }
}
