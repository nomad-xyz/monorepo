// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootLogic} from "../scripts/Reboot.s.sol";
import {NomadTest, NomadTestWithUpdaterManager, ReplicaHandlers} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {ReplicaHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/ReplicaHarness.sol";
import {GovernanceRouterHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/GovernanceRouterHarness.sol";
import {ReplicaTest, ReplicaHandlers} from "@nomad-xyz/contracts-core/contracts/test/Replica.t.sol";
import {HomeTest} from "@nomad-xyz/contracts-core/contracts/test/Home.t.sol";
import {GovernanceRouterTest} from "@nomad-xyz/contracts-core/contracts/test/GovernanceRouter.t.sol";
import {HomeHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/HomeHarness.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {MockHome} from "@nomad-xyz/contracts-bridge/contracts/test/utils/MockHome.sol";
import {MockXAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/test/utils/MockXAppConnectionManager.sol";

contract RebootTest is
    RebootLogic,
    NomadTest,
    NomadTestWithUpdaterManager,
    ReplicaHandlers,
    ReplicaTest,
    HomeTest,
    GovernanceRouterTest
{
    string remote;

    function setUp()
        public
        override(
            NomadTest,
            NomadTestWithUpdaterManager,
            ReplicaHandlers,
            ReplicaTest,
            HomeTest,
            GovernanceRouterTest
        )
    {
        // ALL
        vm.createSelectFork(vm.envString("RPC_URL"), 15_977_625);
        string memory _domain = "ethereum";
        string memory _configName = "config.json";
        __Config_initialize(_configName);
        __CallBatch_initialize(_domain, getDomainNumber(_domain), "", true);
        // call base setup
        super.setUp();
        // basic vars
        remote = getConnections(localDomainName)[0];
        remoteDomain = getDomainNumber(remote);
        homeDomain = getDomainNumber(localDomainName);
        // set fake updater for ethereum & 1 remote chain
        // before updater rotation, so it will be rotated on-chain
        vm.writeJson(
            vm.toString(updaterAddr),
            outputPath,
            protocolAttributePath(localDomainName, "updater")
        );
        vm.writeJson(
            vm.toString(updaterAddr),
            outputPath,
            protocolAttributePath(remote, "updater")
        );
        reloadConfig();
        // perform reboot actions
        reboot(localDomainName);
        // execute governance actions via vm.prank
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
        // HOME
        home = HomeHarness(address(getHome(localDomainName)));
        upgradeHomeHarness();
        updaterManager = getUpdaterManager(localDomainName);
        // REPLICA
        replica = ReplicaHarness(
            address(getReplicaOf(localDomainName, remote))
        );
        upgradeReplicaHarness();
        committedRoot = replica.committedRoot();
        optimisticTimeout = replica.optimisticSeconds();
        setUpBadHandlers();
        // GOVERNANCE ROUTER
        governanceRouter = GovernanceRouterHarness(address(getGovernanceRouter(localDomainName)));
        upgradeGovernanceRouterHarness();
        recoveryManager = getRecoveryManager(localDomainName);
        remoteGovernanceRouter = TypeCasts.addressToBytes32(address(getGovernanceRouter(remote)));
        remoteGovernanceDomain = remoteDomain;
        xAppConnectionManager = MockXAppConnectionManager(address(getXAppConnectionManager(localDomainName)));
        goodXapp = goodXappSimple;
        mockHome = MockHome(address(getHome(localDomainName)));
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

    function upgradeHomeHarness() public {
        // HOME
        HomeHarness homeHarnessImpl = new HomeHarness(
            getDomainNumber(localDomainName)
        );
        vm.writeJson(
            vm.toString(address(homeHarnessImpl)),
            outputPath,
            coreAttributePath(localDomainName, "home.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(homeUpgrade(localDomainName));
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    function upgradeGovernanceRouterHarness() public {
        // GOV ROUTER
        GovernanceRouterHarness govHarnessImpl = new GovernanceRouterHarness(
            getDomainNumber(localDomainName),
            getRecoveryTimelock(localDomainName)
        );
        vm.writeJson(
            vm.toString(address(govHarnessImpl)),
            outputPath,
            coreAttributePath(
                localDomainName,
                "governanceRouter.implementation"
            )
        );
        reloadConfig();
        pushSingleUpgrade(governanceRouterUpgrade(localDomainName));
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    //////////////////////// HOME ////////////////////////
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

    //////////////////////// GOV ROUTER ////////////////////////
}
