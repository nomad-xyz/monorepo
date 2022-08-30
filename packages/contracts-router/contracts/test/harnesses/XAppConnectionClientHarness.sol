// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {XAppConnectionClient} from "../../XAppConnectionClient.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

contract XAppConnectionClientHarness is XAppConnectionClient {
    function exposed_home() external view returns (Home) {
        return _home();
    }

    function exposed_isReplica(address potentialReplica)
        external
        view
        returns (bool)
    {
        return _isReplica(potentialReplica);
    }

    function exposed_localDomain() external view returns (uint32) {
        return _localDomain();
    }

    function exposed_initialize(address xAppCnMngr) external {
        __XAppConnectionClient_initialize(xAppCnMngr);
    }
}
