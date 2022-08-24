// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "../XAppConnectionClient.sol";
import {Home} from "../Home.sol";
import {XAppConnectionManager} from "../XAppConnectionManager.sol";

contract XAppConnectionClientHarness is XAppConnectionClient {
    function exposed_home() external view returns (Home) {
        return _home();
    }

    function exposed_isReplica(address potentialReplica)
        external
        view
        returns (bool)
    {
        return isReplica(potentialReplica);
    }

    function exposed_localDomain() external returns (uint32) {
        return xAppConnectionManager.localDomain();
    }
}
