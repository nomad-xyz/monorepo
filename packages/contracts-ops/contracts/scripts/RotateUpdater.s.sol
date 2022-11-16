// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";

import {Script} from "forge-std/Script.sol";

abstract contract RotateUpdaterLogic is Config, CallBatch {
    function pushSetReplicaUpdater(string memory remoteDomain) private {
        // New updater is the updater for the remote Home
        address newUpdater = getUpdater(remoteDomain);
        Replica replica = getReplicaOf(localDomainName, remoteDomain);
        if (replica.updater() != newUpdater) {
            pushLocal(
                address(replica),
                abi.encodeWithSelector(replica.setUpdater.selector, newUpdater)
            );
        }
    }

    function pushSetHomeUpdater() private {
        address newUpdater = getUpdater(localDomainName);
        Home home = getHome(localDomainName);
        UpdaterManager updaterManager = getUpdaterManager(localDomainName);
        // Updater manager will call `home.setUpdater()`
        if (newUpdater != home.updater()) {
            pushLocal(
                address(updaterManager),
                abi.encodeWithSelector(
                    updaterManager.setUpdater.selector,
                    newUpdater
                )
            );
        }
    }

    // Sets the updater for the home and all replicas
    function pushSetUpdater() internal {
        // Load info from config
        string[] memory connections = getConnections(localDomainName);
        pushSetHomeUpdater();
        // Set each replica
        for (uint256 i = 0; i < connections.length; i++) {
            pushSetReplicaUpdater(connections[i]);
        }
    }
}

contract RotateUpdater is Script, RotateUpdaterLogic {
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
    function rotate(
        string calldata _configName,
        string calldata _localDomain,
        string calldata _batchOutput,
        bool overwrite
    ) public {
        initialize(_configName, _localDomain, _batchOutput, overwrite);
        pushSetUpdater();
        // NOTE: script is currently written for one chain only
        // to be used in recovery mode
        // FUTURE: refactor to be multi-chain
        bool recovery = true;
        writeCallBatch(recovery);
    }
}
