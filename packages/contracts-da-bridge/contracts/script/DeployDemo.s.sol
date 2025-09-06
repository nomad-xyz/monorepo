// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import "forge-std/Script.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {DABridgeRouter} from "../DABridgeRouter.sol";

contract DeployDABridgeRouter is Script {
    uint256 localDomain;
    uint256 remoteDomain;
    address remoteUpdater;
    address daBridgeWatcher;
    uint256 optimisticSeconds;
    bytes32 daBridgePalletId;

    function loadEnvVars() public {
        localDomain = vm.envUint("GOERLI_DOMAIN");
        remoteDomain = vm.envUint("AVAIL_DOMAIN");
        remoteUpdater = vm.envAddress("AVAIL_UPDATER_ADDRESS");
        daBridgeWatcher = vm.envAddress("DA_BRIDGE_WATCHER_ADDRESS");
        optimisticSeconds = vm.envUint("OPTIMISTIC_SECONDS");
        daBridgePalletId = vm.envBytes32("DA_BRIDGE_PALLET_ID");
    }

    function run() external {
        loadEnvVars();

        vm.startBroadcast();

        Home home = new Home(uint32(localDomain));

        Replica replica = new Replica(uint32(localDomain));
        replica.initialize(
            uint32(remoteDomain),
            remoteUpdater,
            bytes32(0),
            optimisticSeconds
        );

        XAppConnectionManager manager = new XAppConnectionManager();

        // Entity to with permission to set home, enroll replica, and set
        // watcher permissions is contract owner (deployer by default).
        manager.setHome(address(home));
        manager.ownerEnrollReplica(address(replica), uint32(remoteDomain));
        manager.setWatcherPermission(
            daBridgeWatcher,
            uint32(remoteDomain),
            true
        );

        DABridgeRouter router = new DABridgeRouter();
        router.initialize(address(manager), uint32(remoteDomain));

        // Entity to with permission to enroll remote router is contract owner
        // (deployer by default).
        router.enrollRemoteRouter(uint32(remoteDomain), daBridgePalletId);

        vm.stopBroadcast();
    }
}
