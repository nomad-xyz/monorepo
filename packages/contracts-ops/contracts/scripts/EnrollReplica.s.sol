// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "forge-std/Script.sol";

contract EnrollReplicasLogic is Config, CallBatch {
    function enrollReplica(string memory remote) internal {
        XAppConnectionManager xcm = xAppconnectionManager(domain);
        address replica = address(replicaOf(domain, remote));
        uint32 domainNumber = domainNumber(remote);
        push(
            address(xcm),
            abi.encodeWithSelector(
                xcm.ownerEnrollReplica.selector,
                replica,
                domainNumber
            )
        );
    }

    function enrollReplicas() internal {
        // Load info from config
        string[] memory connections = connections(domain);
        // Set each replica
        for (uint256 i = 0; i < connections.length; i++) {
            enrollReplica(connections[i]);
        }
    }
}

contract EnrollReplicas is Script, EnrollReplicasLogic {
    function initialize(
        string calldata configFile,
        string calldata localDomain,
        string calldata output
    ) private {
        __Config_initialize(configFile);
        __CallBatch_initialize(localDomain, output);
    }

    // entrypoint
    function createCallList(
        string calldata configFile,
        string calldata localDomain,
        string calldata output
    ) external {
        initialize(configFile, localDomain, output);
        enrollReplicas();
        finish();
    }

    // entrypoint
    function createRecoveryTx(
        string calldata configFile,
        string calldata localDomain,
        string calldata output
    ) external {
        initialize(configFile, localDomain, output);
        enrollReplicas();
        build(address(governanceRouter(localDomain).proxy));
    }
}
