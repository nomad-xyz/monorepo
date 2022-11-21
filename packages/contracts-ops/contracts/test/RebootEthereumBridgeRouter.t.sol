// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootTest} from "./Reboot.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {BridgeRouterBaseTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouterBase.t.sol";
import {EthereumBridgeRouterTest} from "@nomad-xyz/contracts-bridge/contracts/test/EthereumBridgeRouter.t.sol";
import {EthereumBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/BridgeRouterHarness.sol";
import {IBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/IBridgeRouterHarness.sol";

contract EthBridgeRouterRebootTest is RebootTest, EthereumBridgeRouterTest {
    address bridgeRouterHarnessImpl;

    function setUp() public override(EthereumBridgeRouterTest, NomadTest) {
        setUpReboot(1, "bridgerouter");
        // TODO: live accountant?

        // BridgeRouter
        bridgeRouter = IBridgeRouterHarness(address(getBridgeRouter(localDomainName)));

        setUp_upgradeBridgeRouterHarness();
    }

    function setUp_upgradeBridgeRouterHarness() public {
        bridgeRouterHarnessImpl = address(
            new EthereumBridgeRouterHarness(address(getAccountant("ethereum")))
        );
        vm.writeJson(
            vm.toString(bridgeRouterHarnessImpl),
            outputPath,
            bridgeAttributePath(localDomainName, "bridgeRouter.implementation")
        );
        reloadConfig();
        pushSingleUpgrade(homeUpgrade(localDomainName), localDomainName);
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }
}