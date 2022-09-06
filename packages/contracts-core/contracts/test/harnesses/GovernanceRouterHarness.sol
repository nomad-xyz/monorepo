// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {GovernanceRouter} from "../../governance/GovernanceRouter.sol";
import {GovernanceMessage} from "../../governance/GovernanceMessage.sol";

contract GovernanceRouterHarness is GovernanceRouter {
    constructor(uint32 _localDomain, uint256 _recoveryTimelock) GovernanceRouter(_localDomain, _recoveryTimelock) {}

    function exposed_callRemote(uint32 _destination, GovernanceMessage.Call[] calldata _calls) public {
        _callRemote(_destination, _calls);
    }

    function exposed_callLocal(GovernanceMessage.Call memory _call) public returns (bytes memory _ret){
        return _callLocal(_call);
    }
}
