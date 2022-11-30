// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootTest} from "./Reboot.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {HomeTest} from "@nomad-xyz/contracts-core/contracts/test/Home.t.sol";
import {HomeHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/HomeHarness.sol";

contract HomeRebootTest is RebootTest, HomeTest {
    address homeHarnessImpl;

    function setUp() public override(NomadTest, HomeTest) {
        setUpReboot("home");
        // upgrade to harness
        home = HomeHarness(address(getHome(localDomainName)));
        setUp_upgradeHomeHarness();
        // set test vars
        updaterManager = getUpdaterManager(localDomainName);
    }

    // upgrade to harness
    function setUp_upgradeHomeHarness() public {
        // HOME
        homeHarnessImpl = address(
            new HomeHarness(getDomainNumber(localDomainName))
        );
        vm.writeJson(
            vm.toString(homeHarnessImpl),
            outputPath,
            coreAttributePath(localDomainName, "home.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(homeUpgrade(localDomainName), localDomainName);
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    // check fork setUp
    function test_setUp() public {
        assertEq(home.updater(), updaterAddr);
        // assert beacon has been upgraded to harness
        (, bytes memory result) = address(homeUpgrade(localDomainName).beacon)
            .staticcall("");
        address _current = abi.decode(result, (address));
        assertEq(_current, homeHarnessImpl);
    }

    //////////////////////// HOME ////////////////////////
    // HOME
    function test_committedRoot() public view override {
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
        dispatchTestMessage();
        // merkle root is updated (new leaf added)
        assert(home.root() != rootBefore);
        // new root is added to end of Home queue
        assertEq(home.queueLength(), queueLengthBefore + 1);
        assertEq(home.queueEnd(), home.root());
        assert(home.queueEnd() != queueEndBefore);
        // Home committedRoot doesn't change
        assertEq(home.committedRoot(), committedRootBefore);
        // destination domain nonce increases
        assertEq(uint256(home.nonces(remoteDomain)), nonce + 1);
    }

    // HOME
    function test_suggestUpdate() public override {
        dispatchTestMessage();
        (bytes32 oldRoot, bytes32 newRoot) = home.suggestUpdate();
        assertEq(home.committedRoot(), oldRoot);
        assertEq(home.root(), newRoot);
    }
}
