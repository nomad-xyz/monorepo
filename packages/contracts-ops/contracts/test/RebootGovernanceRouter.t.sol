// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {RebootTest} from "./Reboot.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {GovernanceRouterTest} from "@nomad-xyz/contracts-core/contracts/test/GovernanceRouter.t.sol";
import {GovernanceRouterHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/GovernanceRouterHarness.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {MockHome} from "@nomad-xyz/contracts-bridge/contracts/test/utils/MockHome.sol";
import {MockXAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/test/utils/MockXAppConnectionManager.sol";

contract GovernanceRouterRebootTest is RebootTest, GovernanceRouterTest {
    function setUp() public override(NomadTest, GovernanceRouterTest) {
        setUpReboot(3, "governanceRouter");
        // GOVERNANCE ROUTER
        governanceRouter = GovernanceRouterHarness(
            address(getGovernanceRouter(localDomainName))
        );
        upgradeGovernanceRouterHarness();
        recoveryManager = getRecoveryManager(localDomainName);
        remoteGovernanceRouter = TypeCasts.addressToBytes32(
            address(getGovernanceRouter(remote))
        );
        remoteGovernanceDomain = remoteDomain;
        xAppConnectionManager = MockXAppConnectionManager(
            address(getXAppConnectionManager(localDomainName))
        );
        mockHome = MockHome(address(getHome(localDomainName)));
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
}
