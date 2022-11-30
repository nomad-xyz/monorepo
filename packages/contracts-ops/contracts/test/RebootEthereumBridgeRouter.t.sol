// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootTest} from "./Reboot.t.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {BridgeTestFixture} from "@nomad-xyz/contracts-bridge/contracts/test/utils/BridgeTest.sol";
import {BridgeRouterBaseTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouterBase.t.sol";
import {EthereumBridgeRouterTest} from "@nomad-xyz/contracts-bridge/contracts/test/EthereumBridgeRouter.t.sol";
import {NFTRecoveryAccountantHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/NFTAccountantHarness.sol";
import {EthereumBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/BridgeRouterHarness.sol";
import {TokenRegistryHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/TokenRegistryHarness.sol";
import {IBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/IBridgeRouterHarness.sol";
import {BridgeToken} from "@nomad-xyz/contracts-bridge/contracts/BridgeToken.sol";
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";

contract EthereumBridgeRouterRebootTest is
    RebootTest,
    EthereumBridgeRouterTest
{
    address bridgeRouterHarnessImpl;
    address accountantHarnessImpl;
    address tokenRegistryHarnessImpl;

    function setUp() public override(EthereumBridgeRouterTest, NomadTest) {
        setUpReboot("ethBridgeRouter");
        require(
            keccak256(bytes(localDomainName)) == keccak256(bytes("ethereum")),
            "not ethereum bridge router"
        );
        // load proxies
        tokenRegistry = TokenRegistryHarness(
            address(getTokenRegistry(localDomainName))
        );
        vm.label(address(tokenRegistry), "tokenRegistry");
        bridgeRouter = IBridgeRouterHarness(
            address(getBridgeRouter(localDomainName))
        );
        vm.label(address(bridgeRouter), "bridgeRouter");
        accountant = NFTRecoveryAccountantHarness(
            address(getAccountant(ethereum))
        );
        vm.label(address(accountant), "accountant");
        // upgrade to harness
        setUp_upgradeTokenRegistryHarness();
        setUp_upgradeBridgeRouterHarness();
        setUp_upgradeAccountantHarness();
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
        bridgeRouterHarnessImpl = address(
            new EthereumBridgeRouterHarness(
                address(getAccountant(localDomainName))
            )
        );
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

    function setUp_upgradeAccountantHarness() public {
        accountantHarnessImpl = address(
            new NFTRecoveryAccountantHarness(
                address(getBridgeRouter(ethereum)),
                address(getFundsRecipient(ethereum))
            )
        );
        vm.label(accountantHarnessImpl, "accountantHarnessImpl");
        vm.writeJson(
            vm.toString(accountantHarnessImpl),
            outputPath,
            bridgeAttributePath(ethereum, "accountant.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(accountantUpgrade(ethereum), ethereum);
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(ethereum)),
            getDomainNumber(ethereum)
        );
    }

    function test_setUp_rebootBridgeRouter() public {
        // check that the harnesses have harness methods available
        assertEq(
            address(accountant),
            address(
                EthereumBridgeRouterHarness(address(getBridgeRouter(ethereum)))
                    .accountant()
            )
        );
        assertEq(
            bridgeRouterHarnessImpl,
            bridgeRouterUpgrade(localDomainName).implementation
        );
        assertEq(
            tokenRegistryHarnessImpl,
            tokenRegistryUpgrade(localDomainName).implementation
        );
        assertEq(
            accountantHarnessImpl,
            accountantUpgrade(ethereum).implementation
        );
        bridgeRouter.exposed_dust(address(this));
        tokenRegistry.exposed_localDomain();
    }
}
