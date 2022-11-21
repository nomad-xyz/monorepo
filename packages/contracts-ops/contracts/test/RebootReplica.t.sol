// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootTest} from "./Reboot.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {ReplicaHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/ReplicaHarness.sol";
import {ReplicaTest} from "@nomad-xyz/contracts-core/contracts/test/Replica.t.sol";

contract ReplicaRebootTest is RebootTest, ReplicaTest {
    address replicaHarnessImpl;

    function setUp() public override(NomadTest, ReplicaTest) {
        setUpReboot(2, "replica");
        // upgrade to harness
        replica = ReplicaHarness(
            address(getReplicaOf(localDomainName, remote))
        );
        setUp_upgradeReplicaHarness();
        // set test vars
        committedRoot = replica.committedRoot();
        optimisticTimeout = replica.optimisticSeconds();
        setUpBadHandlers();
    }

    // upgrade to harness
    function setUp_upgradeReplicaHarness() public {
        // REPLICA
        replicaHarnessImpl = address(
            new ReplicaHarness(getDomainNumber(localDomainName))
        );
        vm.writeJson(
            vm.toString(replicaHarnessImpl),
            outputPath,
            string(
                abi.encodePacked(
                    replicaOfPath(localDomainName, remote),
                    ".implementation"
                )
            )
        );
        reloadConfig();
        pushSingleUpgrade(
            replicaOfUpgrade(localDomainName, remote),
            localDomainName
        );
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    // check fork setUp
    function test_setUp() public {
        assertEq(replica.updater(), updaterAddr);
        // assert beacon has been upgraded to harness
        (, bytes memory result) = address(
            replicaOfUpgrade(localDomainName, remote).beacon
        ).staticcall("");
        address _current = abi.decode(result, (address));
        assertEq(_current, replicaHarnessImpl);
    }

    // REPLICA
    function test_acceptLeafCorrectProof() public override {
        // TODO: test proof somehow?
    }
}
