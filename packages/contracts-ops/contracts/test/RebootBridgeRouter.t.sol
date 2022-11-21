// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootTest} from "./Reboot.t.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {BridgeTestFixture} from "@nomad-xyz/contracts-bridge/contracts/test/utils/BridgeTest.sol";
import {BridgeRouterBaseTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouterBase.t.sol";
import {BridgeRouterTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouter.t.sol";
import {BridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/BridgeRouterHarness.sol";
import {TokenRegistryHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/TokenRegistryHarness.sol";
import {IBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/IBridgeRouterHarness.sol";
import {BridgeToken} from "@nomad-xyz/contracts-bridge/contracts/BridgeToken.sol";


contract BridgeRouterRebootTest is RebootTest, BridgeRouterTest {
    address bridgeRouterHarnessImpl;
    address tokenRegistryHarnessImpl;

    string constant ethereum = "ethereum";

    function setUp() public override(BridgeRouterBaseTest, NomadTest) {
        setUpReboot(1, "bridgerouter");
        // This line causes a stack overflow in forge.
        // Comment it out and tests will run (but fail)
        // Leave it in and forge will abort
        tokenRegistry = TokenRegistryHarness(address(getTokenRegistry(ethereum)));
        bridgeRouter = IBridgeRouterHarness(address(getBridgeRouter(ethereum)));
        setUp_upgradeTokenRegistryHarness();
        setUp_upgradeBridgeRouterHarness();
        xAppConnectionManager = getXAppConnectionManager(ethereum);
        upgradeBeaconController = getUpgradeBeaconController(ethereum);
        tokenBeacon = UpgradeBeacon(payable(tokenRegistry.tokenBeacon()));
        bridgeToken = BridgeToken(beaconImplementation(tokenBeacon));
        BridgeTestFixture.setUp_testFixtures();

    }

    function setUp_upgradeTokenRegistryHarness() public {
        tokenRegistryHarnessImpl = address(tokenRegistry);
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

    function setUp_upgradeBridgeRouterHarness() public {
        bridgeRouterHarnessImpl = address(new BridgeRouterHarness());
        vm.writeJson(
            vm.toString(bridgeRouterHarnessImpl),
            outputPath,
            bridgeAttributePath(ethereum, "bridgeRouter.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(homeUpgrade(ethereum), ethereum);
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(ethereum)),
            getDomainNumber(ethereum)
        );
    }
}
