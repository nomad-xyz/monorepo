// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";

import "forge-std/Script.sol";

abstract contract RotateUpdaterLogic is Config, CallBatch {
    function setReplicaUpdater(string memory remoteDomain) private {
        // New updater is the updater for the remote Home
        address newUpdater = updater(remoteDomain);
        Replica replica = replicaOf(localDomainName, remoteDomain);
        if (replica.updater() != newUpdater) {
            pushLocal(
                address(replica),
                abi.encodeWithSelector(replica.setUpdater.selector, newUpdater)
            );
        }
    }

    function setHomeUpdater() private {
        address newUpdater = updater(localDomainName);
        Home home = home(localDomainName);
        UpdaterManager updaterManager = updaterManager(localDomainName);
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
    function setUpdater() internal {
        // Load info from config
        string[] memory connections = connections(localDomainName);
        setHomeUpdater();
        // Set each replica
        for (uint256 i = 0; i < connections.length; i++) {
            setReplicaUpdater(connections[i]);
        }
    }
}

abstract contract RotateUpdater is Script, RotateUpdaterLogic {
    function initialize(
        string calldata configFile,
        string calldata _localDomain,
        string calldata output,
        bool overwrite
    ) private {
        __Config_initialize(configFile);
        __CallBatch_initialize(
            _localDomain,
            domainNumber(_localDomain),
            output,
            overwrite
        );
    }

    // entrypoint
    function rotate(
        string calldata configFile,
        string calldata _localDomain,
        string calldata output,
        bool overwrite
    ) public {
        initialize(configFile, _localDomain, output, overwrite);
        setUpdater();
        // NOTE: script is currently written for one chain only
        // to be used in recovery mode
        // FUTURE: refactor to be multi-chain
        bool recovery = true;
        writeCallBatch(recovery);
    }
}
