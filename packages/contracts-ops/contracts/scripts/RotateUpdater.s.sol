// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";

import "forge-std/Script.sol";

contract RotateUpdater is Script, Config, CallBatch {
    function setReplicaUpdater(
        string memory localDomain,
        string memory remoteDomain
    ) private {
        // New updater is the updater for the remote Home
        address newUpdater = updater(remoteDomain);
        Replica replica = replicaOf(localDomain, remoteDomain);
        if (replica.updater() != newUpdater) {
            push(
                address(replica),
                abi.encodeWithSelector(replica.setUpdater.selector, newUpdater)
            );
        }
    }

    function setHomeUpdater() private {
        address newUpdater = updater(domain);
        Home home = home(domain);
        UpdaterManager updaterManager = updaterManager(domain);
        // Updater manager will call `home.setUpdater()`
        if (newUpdater != home.updater()) {
            push(
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
        string[] memory connections = connections(domain);
        setHomeUpdater();
        // Set each replica
        for (uint256 i = 0; i < connections.length; i++) {
            setReplicaUpdater(domain, connections[i]);
        }
    }

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
    ) public {
        initialize(configFile, localDomain, output);
        setUpdater();
        finish();
    }

    // entrypoint
    function createRecoveryTx(
        string calldata configFile,
        string calldata localDomain,
        string calldata output
    ) public {
        initialize(configFile, localDomain, output);
        setUpdater();
        build(address(governanceRouter(localDomain).proxy));
    }
}
