// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {RebootTest} from "./Reboot.t.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {GoodXappSimple} from "@nomad-xyz/contracts-core/contracts/test/utils/GoodXapps.sol";
import {GovernanceRouterTest} from "@nomad-xyz/contracts-core/contracts/test/GovernanceRouter.t.sol";
import {GovernanceRouterHarness} from "@nomad-xyz/contracts-core/contracts/test/harnesses/GovernanceRouterHarness.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {MockHome} from "@nomad-xyz/contracts-bridge/contracts/test/utils/MockHome.sol";
import {MockXAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/test/utils/MockXAppConnectionManager.sol";

contract GovernanceRouterRebootTest is RebootTest, GovernanceRouterTest {
    address govHarnessImpl;

    function setUp() public override(NomadTest, GovernanceRouterTest) {
        setUpReboot(3, "governanceRouter");
        // upgrade to harness
        governanceRouter = GovernanceRouterHarness(
            address(getGovernanceRouter(localDomainName))
        );
        setUp_upgradeGovernanceRouterHarness();
        // set test vars
        recoveryManager = getRecoveryManager(localDomainName);
        remoteGovernanceRouter = TypeCasts.addressToBytes32(
            address(getGovernanceRouter(remote))
        );
        xAppConnectionManager = getXAppConnectionManager(localDomainName);
        home = MockHome(address(getHome(localDomainName)));
        // set up fixtures
        GovernanceRouterTest.setUp_testFixtures();
    }

    function setUp_upgradeGovernanceRouterHarness() public {
        // GOV ROUTER
        govHarnessImpl = address(
            new GovernanceRouterHarness(
                getDomainNumber(localDomainName),
                getRecoveryTimelock(localDomainName)
            )
        );
        vm.writeJson(
            vm.toString(govHarnessImpl),
            outputPath,
            coreAttributePath(
                localDomainName,
                "governanceRouter.implementation"
            )
        );
        reloadConfig();
        pushSingleUpgrade(
            governanceRouterUpgrade(localDomainName),
            localDomainName
        );
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
    }

    // check fork setUp
    function test_setUp() public {
        // assert beacon has been upgraded to harness
        (, bytes memory result) = address(
            governanceRouterUpgrade(localDomainName).beacon
        ).staticcall("");
        address _current = abi.decode(result, (address));
        assertEq(_current, govHarnessImpl);
    }
}
