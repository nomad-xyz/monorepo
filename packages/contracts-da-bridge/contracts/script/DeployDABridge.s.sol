// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import "forge-std/Script.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {DABridgeRouter} from "../DABridgeRouter.sol";

contract DeployDABridgeRouter is Script {
    address constant HOME_ADDRESS = 0x0000000000000000000000000000000000000000;
    address constant REPLICA_ADDRESS =
        0x0000000000000000000000000000000000000000;
    uint32 constant REPLICA_DOMAIN = uint32(0);

    function run() external {
        vm.startBroadcast();

        XAppConnectionManager manager = new XAppConnectionManager();
        manager.setHome(HOME_ADDRESS);
        manager.ownerEnrollReplica(REPLICA_ADDRESS, REPLICA_DOMAIN);

        DABridgeRouter router = new DABridgeRouter();
        router.setXAppConnectionManager(address(manager));

        vm.stopBroadcast();
    }
}
