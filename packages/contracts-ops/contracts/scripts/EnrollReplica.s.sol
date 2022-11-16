// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import {Script, console2} from "forge-std/Script.sol";

abstract contract EnrollReplicasLogic is Config, CallBatch {
    function pushEnrollReplica(string memory remote) internal {
        XAppConnectionManager xcm = getXAppConnectionManager(localDomainName);
        address replica = address(getReplicaOf(localDomainName, remote));
        uint32 domainNumber = getDomainNumber(remote);

        if (xcm.replicaToDomain(replica) != domainNumber) {
            console2.log("   enroll replica ", remote);
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

    function pushEnrollReplicas() internal {
        console2.log("enroll replicas ", localDomainName);
        // Load info from config
        string[] memory connections = getConnections(localDomainName);
        // Set each replica
        for (uint256 i = 0; i < connections.length; i++) {
            pushEnrollReplica(connections[i]);
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
        __CallBatch_initialize(
            _localDomain,
            getDomainNumber(_localDomain),
            output,
            overwrite
        );
    }

    // entrypoint
    function enroll(
        string calldata configFile,
        string calldata _localDomain,
        string calldata output,
        bool overwrite
    ) external {
        initialize(configFile, _localDomain, output, overwrite);
        pushEnrollReplicas();
        // NOTE: script is currently written for one chain only
        // to be used in recovery mode
        // FUTURE: refactor to be multi-chain
        bool recovery = true;
        writeCallBatch(recovery);
    }
}
