// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Config} from "./Config.sol";
import {CallBatch} from "./CallBatch.sol";

import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";

import "forge-std/Script.sol";

contract RotateUpdater is Script, Config, CallBatch {
    function setReplicaUpdater(
        string memory localDomain,
        string memory connection,
        address newUpdater
    ) private {
        Replica replica = replicaOf(localDomain, connection);
        if (replica.updater() != newUpdater) {
            push(
                address(replica),
                abi.encodeWithSelector(replica.setUpdater.selector, newUpdater)
            );
        }
    }

    function run(
        string calldata configFile,
        string calldata localDomain,
        string calldata output
    ) public {
        __Config_initialize(configFile);
        __CallBatch_initialize(localDomain, output);

        string[] memory connections = connections(localDomain);
        address newUpdater = updater(localDomain);

        Home home = home(localDomain);
        UpdaterManager updaterManager = updaterManager(localDomain);

        if (newUpdater != home.updater()) {
            push(
                address(updaterManager),
                abi.encodeWithSelector(
                    updaterManager.setUpdater.selector,
                    newUpdater
                )
            );
        }

        for (uint256 i = 0; i < connections.length; i++) {
            setReplicaUpdater(localDomain, connections[i], newUpdater);
        }

        finish();
    }
}
