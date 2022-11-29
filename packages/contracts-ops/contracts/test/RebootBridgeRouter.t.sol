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
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";

contract BridgeRouterRebootTest is RebootTest, BridgeRouterTest {
    address bridgeRouterHarnessImpl;
    address tokenRegistryHarnessImpl;

    function setUp() public override(BridgeRouterBaseTest, NomadTest) {
        setUpReboot("bridgeRouter");
        // load proxies
        tokenRegistry = TokenRegistryHarness(
            address(getTokenRegistry(localDomainName))
        );
        vm.label(address(tokenRegistry), "tokenRegistry");
        bridgeRouter = IBridgeRouterHarness(
            address(getBridgeRouter(localDomainName))
        );
        vm.label(address(bridgeRouter), "bridgeRouter");
        // upgrade to harness
        setUp_upgradeTokenRegistryHarness();
        setUp_upgradeBridgeRouterHarness();
        // load necessary contracts
        xAppConnectionManager = getXAppConnectionManager(localDomainName);
        vm.label(address(xAppConnectionManager), "XAppConnectionManager");
        upgradeBeaconController = getUpgradeBeaconController(localDomainName);
        vm.label(address(upgradeBeaconController), "upgradeBeaconController");
        tokenBeacon = UpgradeBeacon(payable(tokenRegistry.tokenBeacon()));
        vm.label(address(tokenBeacon), "tokenBeacon");
        bridgeToken = BridgeToken(beaconImplementation(tokenBeacon));
        vm.label(address(bridgeToken), "bridgeToken");
        // home needed for vm.expectCall
        home = address(getHome(localDomainName));
        vm.label(home, "home");
        BridgeRouterBaseTest.setUp_testFixtures();
    }

    function setUp_upgradeTokenRegistryHarness() public {
        tokenRegistryHarnessImpl = address(new TokenRegistryHarness());
        vm.label(tokenRegistryHarnessImpl, "tokenRegistryHarnessImpl");
        vm.writeJson(
            vm.toString(tokenRegistryHarnessImpl),
            outputPath,
            bridgeAttributePath(localDomainName, "tokenRegistry.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(
            tokenRegistryUpgrade(localDomainName),
            localDomainName
        );
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    function setUp_upgradeBridgeRouterHarness() public {
        bridgeRouterHarnessImpl = address(new BridgeRouterHarness());
        vm.label(bridgeRouterHarnessImpl, "bridgeRouterHarnessImpl");
        vm.writeJson(
            vm.toString(bridgeRouterHarnessImpl),
            outputPath,
            bridgeAttributePath(localDomainName, "bridgeRouter.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(
            bridgeRouterUpgrade(localDomainName),
            localDomainName
        );
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    function test_setUp_rebootBridgeRouter() public {
        // check that the harnesses have harness methods available
        assertEq(
            bridgeRouterHarnessImpl,
            bridgeRouterUpgrade(localDomainName).implementation
        );
        assertEq(
            tokenRegistryHarnessImpl,
            tokenRegistryUpgrade(localDomainName).implementation
        );
        bridgeRouter.exposed_dust(address(this));
        tokenRegistry.exposed_localDomain();
    }
}
