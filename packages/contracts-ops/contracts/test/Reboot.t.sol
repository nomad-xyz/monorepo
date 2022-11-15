// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RotateUpdaterLogic} from "../scripts/RotateUpdater.s.sol";
import {EnrollReplicasLogic} from "../scripts/EnrollReplica.s.sol";
import {DeployAccountantLogic} from "../scripts/DeployAccountant.s.sol";
import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";
import {DeployAndInitializeImplementationsLogic} from "../scripts/InitializeImplementations.s.sol";
import {UpgradeCallBatchLogic} from "../scripts/UpgradeCallBatches.s.sol";

contract RebootTest is
    Config,
    CallBatch,
    RotateUpdaterLogic,
    EnrollReplicasLogic,
    DeployAccountantLogic,
    DeployAndInitializeImplementationsLogic,
    UpgradeCallBatchLogic,
    Test
{
    function setUp() public {
        string memory _domain = "ethereum";
        __Config_initialize("./actions/config.json");
        __CallBatch_initialize(_domain, getDomainNumber(_domain), "", true);
        // deploy accountant contracts
        deployAccountant(_domain);
        // deploy implementations
        deployImplementations(_domain);
        // initialize implementations
        initializeImplementations(_domain);
        // push upgrade writeCallBatch
        upgrade(_domain);
        assertEq(localCalls.length, 6);
        // generate governance actions for Rotate Updater
        setUpdater();
        assertEq(localCalls.length, 12);
        // generate governance actions to Enroll Replicas
        enrollReplicas();
        assertEq(localCalls.length, 17);
        // execute governance actions
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(_domain)),
            getDomainNumber(_domain)
        );
    }

    function test_setup() public {
        assertEq(
            getUpdater("ethereum"),
            0x71dC76C07E92325e7Cc09117AB94310Da63Fc2b9
        );
    }
}
