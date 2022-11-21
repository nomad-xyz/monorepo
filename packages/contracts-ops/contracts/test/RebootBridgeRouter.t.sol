// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootTest} from "./Reboot.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {BridgeRouterBaseTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouterBase.t.sol";
import {BridgeRouterTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouter.t.sol";
import {BridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/BridgeRouterHarness.sol";
import {IBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/IBridgeRouterHarness.sol";

contract BridgeRouterRebootTest is RebootTest, BridgeRouterTest {
    address bridgeRouterHarnessImpl;

    function setUp() public override(BridgeRouterBaseTest, NomadTest) {
        setUpReboot(1, "bridgerouter");
        // BridgeRouter
        bridgeRouter = IBridgeRouterHarness(address(getBridgeRouter(localDomainName)));
        setUp_upgradeBridgeRouterHarness();
    }

    function setUp_upgradeBridgeRouterHarness() public {
        bridgeRouterHarnessImpl = address(
            new BridgeRouterHarness()
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