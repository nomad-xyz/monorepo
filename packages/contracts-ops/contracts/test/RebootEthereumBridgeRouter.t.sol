// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RebootTest} from "./Reboot.t.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {BridgeTestFixture} from "@nomad-xyz/contracts-bridge/contracts/test/utils/BridgeTest.sol";
import {BridgeRouterBaseTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouterBase.t.sol";
import {BridgeRouterTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouter.t.sol";
import {EthereumBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/BridgeRouterHarness.sol";
import {TokenRegistryHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/TokenRegistryHarness.sol";
import {IBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/IBridgeRouterHarness.sol";
import {BridgeToken} from "@nomad-xyz/contracts-bridge/contracts/BridgeToken.sol";
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";

contract EthereumBridgeRouterRebootTest is RebootTest, BridgeRouterTest {
    address bridgeRouterHarnessImpl;
    address tokenRegistryHarnessImpl;

    string constant ethereum = "ethereum";

    function setUp() public override(BridgeRouterBaseTest, NomadTest) {
        setUpReboot("ethBridgeRouter");
        // load proxies
        tokenRegistry = TokenRegistryHarness(
            address(getTokenRegistry(ethereum))
        );
        vm.label(address(tokenRegistry), "tokenRegistry");
        bridgeRouter = IBridgeRouterHarness(address(getBridgeRouter(ethereum)));
        vm.label(address(bridgeRouter), "bridgeRouter");
        // upgrade to harness
        setUp_upgradeTokenRegistryHarness();
        setUp_upgradeBridgeRouterHarness();
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
        home = address(getHome("ethereum"));
        vm.label(home, "home");
        BridgeRouterBaseTest.setUp_testFixtures();
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

    function setUp_upgradeBridgeRouterHarness() public {
        bridgeRouterHarnessImpl = address(
            new EthereumBridgeRouterHarness(address(getAccountant(ethereum)))
        );
        vm.label(bridgeRouterHarnessImpl, "bridgeRouterHarnessImpl");
        vm.writeJson(
            vm.toString(bridgeRouterHarnessImpl),
            outputPath,
            bridgeAttributePath(ethereum, "bridgeRouter.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(bridgeRouterUpgrade(ethereum), ethereum);
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(ethereum)),
            getDomainNumber(ethereum)
        );
    }

    function test_setUp_rebootBridgeRouter() public {
        // check that the harnesses have harness methods available
        assertEq(
            bridgeRouterHarnessImpl,
            bridgeRouterUpgrade(ethereum).implementation
        );
        assertEq(
            tokenRegistryHarnessImpl,
            tokenRegistryUpgrade(ethereum).implementation
        );
        bridgeRouter.exposed_dust(address(this));
        tokenRegistry.exposed_localDomain();
    }
}


contract EthBridgeSanityTest is Test {
    address br = 0x88A69B4E698A4B090DF6CF5Bd7B2D47325Ad30A3;
    address acc = 0xa4B86BcbB18639D8e708d6163a0c734aFcDB770c;
    address[14] affected = [
            0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599,
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            0x853d955aCEf822Db058eb8505911ED77F175b99e,
            0xdAC17F958D2ee523a2206206994597C13D831ec7,
            0x6B175474E89094C44Da98b954EedeAC495271d0F,
            0xD417144312DbF50465b1C641d016962017Ef6240,
            0x3d6F0DEa3AC3C607B3998e6Ce14b6350721752d9,
            0x40EB746DEE876aC1E78697b7Ca85142D178A1Fc8,
            0xf1a91C7d44768070F711c68f33A7CA25c8D30268,
            0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0,
            0x3431F91b3a388115F00C5Ba9FdB899851D005Fb5,
            0xE5097D9baeAFB89f9bcB78C9290d545dB5f9e9CB,
            0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871
        ];

    function test_tokenSanity() public {
        for (uint256 i = 0; i < affected.length; i++) {
            address assetAddr = affected[i];
            IERC20 asset = IERC20(assetAddr);
            uint256 bal = asset.balanceOf(br);
            if (bal > 0) {
                vm.prank(br);
                asset.approve(acc, bal);
                vm.prank(acc);
                asset.transferFrom(br, acc, bal);
                assertEq(asset.balanceOf(br), 0);
            }
        }
    }
}
