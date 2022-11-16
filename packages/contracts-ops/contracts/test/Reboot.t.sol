// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootLogic} from "../scripts/Reboot.s.sol";
import {ReplicaTest} from "@nomad-xyz/contracts-core/contracts/test/Replica.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {ReplicaHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/ReplicaHarness.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";

contract RebootTest is RebootLogic, ReplicaTest {
    string remote;

    function setUp() public override {
        string memory _domain = "ethereum";
        string memory _configName = "config.json";
        __Config_initialize(_configName);
        __CallBatch_initialize(_domain, getDomainNumber(_domain), "", true);
        // call base setup
        super.setUp();
        // set fake updater for ethereum & 1 remote chain
        // before updater rotation, so it will be rotated on-chain
        vm.writeJson(
            vm.toString(updaterAddr),
            outputPath,
            protocolAttributePath(remote, "updater")
        );
        reloadConfig();
        // perform reboot actions
        reboot(_domain);
        // execute governance actions via vm.prank
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(_domain)),
            getDomainNumber(_domain)
        );
        // set remote domain to actual values
        remote = getConnections(_domain)[0];
        remoteDomain = getDomainNumber(remote);
        // set home domain to actual values
        homeDomain = getDomainNumber(_domain);
        // setup replica to actual value
        Replica rep = getReplicaOf(localDomainName, remote);
        replica = ReplicaHarness(address(rep));
        // set committed root and optimistic timeout
        committedRoot = replica.committedRoot();
        optimisticTimeout = replica.optimisticSeconds();
        // setup fake app handlers
        setUpBadHandlers();
    }

    function test_setUp() public {
        assertEq(getUpdater(remote), updaterAddr);
        assertEq(replica.updater(), updaterAddr);
        assertEq(address(replica), 0x5D94309E5a0090b165FA4181519701637B6DAEBA);
    }
}
