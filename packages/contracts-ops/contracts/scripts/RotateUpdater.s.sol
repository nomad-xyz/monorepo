// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";

import "forge-std/Script.sol";

contract RotateUpdaterLogic is Config, CallBatch {
    function setReplicaUpdater(string memory remoteDomain) private {
        // New updater is the updater for the remote Home
        address newUpdater = updater(remoteDomain);
        Replica replica = replicaOf(localDomain, remoteDomain);
        if (replica.updater() != newUpdater) {
            pushLocal(
                address(replica),
                abi.encodeWithSelector(replica.setUpdater.selector, newUpdater)
            );
        }
    }

    function setHomeUpdater() private {
        address newUpdater = updater(localDomain);
        Home home = home(localDomain);
        UpdaterManager updaterManager = updaterManager(localDomain);
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
        string[] memory connections = connections(localDomain);
        setHomeUpdater();
        // Set each replica
        for (uint256 i = 0; i < connections.length; i++) {
            setReplicaUpdater(connections[i]);
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
        __CallBatch_initialize(_localDomain, output, overwrite);
    }

    // entrypoint
    function createCallList(
        string calldata configFile,
        string calldata _localDomain,
        string calldata output,
        bool overwrite
    ) public {
        initialize(configFile, _localDomain, output, overwrite);
        setUpdater();
        finish();
    }

    // entrypoint
    function createRecoveryTx(
        string calldata configFile,
        string calldata _localDomain,
        string calldata output,
        bool overwrite
    ) public {
        initialize(configFile, _localDomain, output, overwrite);
        setUpdater();
        build(address(governanceRouter(_localDomain)));
    }
}
