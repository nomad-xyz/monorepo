// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootTest} from "./Reboot.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {ReplicaHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/ReplicaHarness.sol";
import {ReplicaTest} from "@nomad-xyz/contracts-core/contracts/test/Replica.t.sol";

contract ReplicaRebootTest is RebootTest, ReplicaTest {

    function setUp() public override(NomadTest, ReplicaTest) {
        setUpReboot(2, "replica");
        // REPLICA
        replica = ReplicaHarness(
            address(getReplicaOf(localDomainName, remote))
        );
        assertEq(replica.updater(), updaterAddr);
        upgradeReplicaHarness();
        committedRoot = replica.committedRoot();
        optimisticTimeout = replica.optimisticSeconds();
        setUpBadHandlers();
    }

    function upgradeReplicaHarness() public {
        // REPLICA
        ReplicaHarness replicaHarnessImpl = new ReplicaHarness(
            getDomainNumber(localDomainName)
        );
        vm.writeJson(
            vm.toString(address(replicaHarnessImpl)),
            outputPath,
            string(
                abi.encodePacked(
                    replicaOfPath(localDomainName, remote),
                    ".implementation"
                )
            )
        );
        reloadConfig();
        pushSingleUpgrade(replicaOfUpgrade(localDomainName, remote));
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    // REPLICA
    function test_acceptLeafCorrectProof() public override {
        // TODO: test proof somehow?
    }
}
