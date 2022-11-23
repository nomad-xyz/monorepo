// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootTest} from "./Reboot.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {TokenRegistryTest} from "@nomad-xyz/contracts-bridge/contracts/test/TokenRegistry.t.sol";
import {TokenRegistryHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/TokenRegistryHarness.sol";
import {BridgeToken} from "@nomad-xyz/contracts-bridge/contracts/BridgeToken.sol";
import {EthereumBridgeRouter} from "@nomad-xyz/contracts-bridge/contracts/BridgeRouter.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {IBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/IBridgeRouterHarness.sol";

contract TokenRegistryRebootTest is RebootTest, TokenRegistryTest {
    address tokenRegistryHarnessImpl;

    string constant ethereum = "ethereum";

    function setUp() public override(NomadTest, TokenRegistryTest) {
        setUpReboot(1, "tokenregistry");
        tokenRegistry = TokenRegistryHarness(
            address(getTokenRegistry(ethereum))
        );
        vm.label(address(tokenRegistry), "tokenRegistry");
        bridgeRouter = IBridgeRouterHarness(address(getBridgeRouter(ethereum)));
        vm.label(address(bridgeRouter), "bridgeRouter");
        // upgrade to harness
        setUp_upgradeTokenRegistryHarness();
        // load necessary contracts
        xAppConnectionManager = getXAppConnectionManager(ethereum);
        vm.label(address(xAppConnectionManager), "XAppConnectionManager");
        upgradeBeaconController = getUpgradeBeaconController(ethereum);
        vm.label(address(upgradeBeaconController), "upgradeBeaconController");
        tokenBeacon = UpgradeBeacon(payable(tokenRegistry.tokenBeacon()));
        vm.label(address(tokenBeacon), "tokenBeacon");
        bridgeToken = BridgeToken(beaconImplementation(tokenBeacon));
        vm.label(address(bridgeToken), "bridgeToken");
        // home needed for vm.expectCall
        home = address(getHome(ethereum));
        vm.label(home, "home");
        // BridgeTestFixture.setUp_testFixtures()
        setUp_testFixtures();
    }

    function setUp_upgradeTokenRegistryHarness() public {
        tokenRegistryHarnessImpl = address(new TokenRegistryHarness());
        vm.label(tokenRegistryHarnessImpl, "tokenRegistryHarnessImpl");
        vm.writeJson(
            vm.toString(tokenRegistryHarnessImpl),
            outputPath,
            bridgeAttributePath(ethereum, "tokenRegistry.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(tokenRegistryUpgrade(ethereum), ethereum);
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(ethereum)),
            getDomainNumber(ethereum)
        );
    }
}
