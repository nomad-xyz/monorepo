// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootLogic} from "../scripts/Reboot.s.sol";
import {NomadTest, NomadTestWithUpdaterManager, ReplicaHandlers} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {ReplicaHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/ReplicaHarness.sol";
import {ReplicaTest, ReplicaHandlers} from "@nomad-xyz/contracts-core/contracts/test/Replica.t.sol";
import {HomeTest} from "@nomad-xyz/contracts-core/contracts/test/Home.t.sol";
import {HomeHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/HomeHarness.sol";

contract RebootTest is
    RebootLogic,
    NomadTest,
    NomadTestWithUpdaterManager,
    ReplicaHandlers,
    ReplicaTest,
    HomeTest
{
    string remote;

    function setUp()
        public
        override(
            NomadTest,
            NomadTestWithUpdaterManager,
            ReplicaHandlers,
            ReplicaTest,
            HomeTest
        )
    {
        vm.createSelectFork(vm.envString("RPC_URL"), 15_977_625);
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
        replica = ReplicaHarness(
            address(getReplicaOf(localDomainName, remote))
        );
        home = HomeHarness(
            address(getHome(_domain))
        );
        updaterManager = getUpdaterManager(_domain);
        // set committed root and optimistic timeout
        committedRoot = replica.committedRoot();
        optimisticTimeout = replica.optimisticSeconds();
        // setup fake app handlers
        setUpBadHandlers();
        // Upgrade to Harness
        // deploy ReplicaHarness implementation
        ReplicaHarness replicaHarnessImpl = new ReplicaHarness(
            getDomainNumber(localDomainName)
        );
        HomeHarness homeHarnessImpl = new HomeHarness(
            getDomainNumber(localDomainName)
        );
        // update config with new implementation
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
        vm.writeJson(
            vm.toString(address(homeHarnessImpl)),
            outputPath,
            coreAttributePath(_domain, "home.implementation")
        );
        reloadConfig();
        // push upgrade call for harness
        pushSingleUpgrade(replicaOfUpgrade(localDomainName, remote));
        pushSingleUpgrade(homeUpgrade(localDomainName));

        // execute upgrade call
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    // HOME
    function test_committedRoot() public override {
        // updates have been submitted so committed root is no longer zero
        assert(home.committedRoot() != bytes32(0));
    }

    // HOME
    function test_dispatchSuccess() public override {
        uint256 nonce = home.nonces(remoteDomain);
        bytes32 committedRootBefore = home.committedRoot();
        uint256 queueLengthBefore = home.queueLength();
        bytes32 queueEndBefore = home.queueEnd();
        bytes32 rootBefore = home.root();
        (bytes memory message, uint256 leafIndex) = dispatchTestMessage();
        // merkle root is updated (new leaf added)
        assert(home.root() != rootBefore);
        // new root is added to end of Home queue
        assertEq(home.queueLength(), queueLengthBefore + 1);
        assertEq(home.queueEnd(), home.root());
        // Home committedRoot doesn't change
        assertEq(home.committedRoot(), committedRootBefore);
        // destination domain nonce increases
        assertEq(uint256(home.nonces(remoteDomain)), nonce + 1);
    }

    // HOME
    function test_suggestUpdate() public override {
        (bytes memory message, ) = dispatchTestMessage();
        (bytes32 oldRoot, bytes32 newRoot) = home.suggestUpdate();
        assertEq(home.committedRoot(), oldRoot);
        assertEq(home.root(), newRoot);
    }
}
