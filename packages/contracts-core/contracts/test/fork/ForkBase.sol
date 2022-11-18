// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {UpgradeCallBatchLogic} from "@nomad-xyz/contracts-ops/contracts/scripts/UpgradeCallBatches.s.sol";
import {Home} from "../harnesses/HomeHarness.sol";
import {ReplicaHarness} from "../harnesses/ReplicaHarness.sol";
import {GovernanceRouterHarness} from "../harnesses/GovernanceRouterHarness.sol";
import {XAppConnectionManager} from "../../XAppConnectionManager.sol";
import {UpdaterManager} from "../../UpdaterManager.sol";

contract ForkBase is UpgradeCallBatchLogic, Test {
    Home home;
    ReplicaHarness replica;
    GovernanceRouterHarness governanceRouter;
    XAppConnectionManager xAppConnectionManager;
    UpdaterManager updaterManager;

    string configName;
    string govDomain;

    string local;
    string remote;
    uint32 remoteDomain;
    // Defined in CallBatch, which is inherited via UpgradeCallBatchLogic
    // uint32 localDomain;

    uint256 optimisticTimeout;

    function setUp() public virtual {
        __Config_initialize(configName);
        __CallBatch_initialize(govDomain, getDomainNumber(local), "", true);

        // set remote domain to actual values
        remote = getConnections(local)[0];
        remoteDomain = getDomainNumber(remote);
        // set home domain to actual values
        localDomain = getDomainNumber(local);
        // setup replica to actual value
        replica = ReplicaHarness(
            address(getReplicaOf(localDomainName, remote))
        );
        optimisticTimeout = replica.optimisticSeconds();
        // Upgrade Replica to Replica Harness
        // deploy ReplicaHarness implementation
        ReplicaHarness harnessImpl = new ReplicaHarness(
            getDomainNumber(localDomainName)
        );
        // update config with new implementation
        vm.writeJson(
            vm.toString(address(harnessImpl)),
            outputPath,
            string(
                abi.encodePacked(
                    replicaOfPath(localDomainName, remote),
                    ".implementation"
                )
            )
        );
        reloadConfig();
        // push upgrade call for harness
        pushSingleUpgrade(replicaOfUpgrade(localDomainName, remote));
        // execute upgrade call
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }
}

contract EthProdForkCore is ForkCoreBase {
    function setUp() override {
        localDomain = "ethereum";
        configName = "production.json";
        vm.ffi(
            "curl https://nomad-xyz.github.io/config/production.json > actions/production.json"
        );
        super.setUp();
    }
}
