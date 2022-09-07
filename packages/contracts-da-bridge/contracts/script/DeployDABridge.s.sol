// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import "forge-std/Script.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import {DABridgeRouter} from "../DABridgeRouter.sol";

contract DeployDABridgeRouter is Script {
    uint256 localDomain;
    uint256 remoteDomain;
    address remoteUpdater;
    uint256 optimisticSeconds;

    function loadEnvVars() public {
        localDomain = vm.envUint("LOCAL_DOMAIN");
        remoteDomain = vm.envUint("REMOTE_DOMAIN");
        remoteUpdater = vm.envAddress("REMOTE_UPDATER");
        optimisticSeconds = vm.envUint("OPTIMISTIC_SECONDS");
    }

    function run() external {
        vm.startBroadcast();

        Replica replica = new Replica(uint32(localDomain));
        replica.initialize(
            uint32(remoteDomain),
            remoteUpdater,
            bytes32(0),
            optimisticSeconds
        );

        XAppConnectionManager manager = new XAppConnectionManager();
        manager.ownerEnrollReplica(address(replica), uint32(remoteDomain));

        DABridgeRouter router = new DABridgeRouter();
        router.initialize(address(manager));

        vm.stopBroadcast();
    }
}
