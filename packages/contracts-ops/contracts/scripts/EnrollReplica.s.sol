// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "forge-std/Script.sol";

contract EnrollReplicasLogic is Config, CallBatch {
    function enrollReplica(string memory remote) internal {
        XAppConnectionManager xcm = xAppConnectionManager(localDomain);
        address replica = address(replicaOf(localDomain, remote));
        uint32 domainNumber = domainNumber(remote);

        if (xcm.replicaToDomain(replica) != domainNumber) {
            pushLocal(
                address(xcm),
                abi.encodeWithSelector(
                    xcm.ownerEnrollReplica.selector,
                    replica,
                    domainNumber
                )
            );
        }
    }

    function enrollReplicas() internal {
        // Load info from config
        string[] memory connections = connections(localDomain);
        // Set each replica
        for (uint256 i = 0; i < connections.length; i++) {
            enrollReplica(connections[i]);
        }
    }
}

contract EnrollReplicas is Script, EnrollReplicasLogic {
    function initialize(
        string calldata configFile,
        string calldata _localDomain,
        string calldata output,
        bool overwrite
    ) private {
        __Config_initialize(configFile);
        __CallBatch_initialize(_localDomain, output, overwrite);
    }

    // entrypoint
    function createCallList(
        string calldata configFile,
        string calldata _localDomain,
        string calldata output,
        bool overwrite
    ) external {
        initialize(configFile, _localDomain, output, overwrite);
        enrollReplicas();
        finish();
    }

    // entrypoint
    function createRecoveryTx(
        string calldata configFile,
        string calldata _localDomain,
        string calldata output,
        bool overwrite
    ) external {
        initialize(configFile, _localDomain, output, overwrite);
        enrollReplicas();
        build(address(governanceRouter(_localDomain)));
    }
}
