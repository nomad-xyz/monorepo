// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

import {DeployAccountantLogic} from "../scripts/DeployAccountant.s.sol";
import {DeployImplementationsLogic} from "../scripts/DeployImplementations.s.sol";
import {InitializeImplementationsLogic} from "../scripts/InitializeImplementations.s.sol";
import {UpgradeCallBatchLogic} from "../scripts/UpgradeCallBatches.s.sol";
import {RotateUpdaterLogic} from "../scripts/RotateUpdater.s.sol";
import {EnrollReplicasLogic} from "../scripts/EnrollReplica.s.sol";

contract RebootTest is
    Config,
    CallBatch,
    RotateUpdaterLogic,
    EnrollReplicasLogic,
    DeployAccountantLogic,
    DeployImplementationsLogic,
    InitializeImplementationsLogic,
    UpgradeCallBatchLogic,
    Test
{
    function setUp() public {}

    function test_setup() public {
        string memory _domain = "ethereum";
        string memory _configPath = "./actions/config.json";
        __Config_initialize(_configPath);
        __CallBatch_initialize(_domain, getDomainNumber(_domain), "", true);
        // deploy accountant setup
        deployAccountant(_domain);
        updateAccountant(_domain, _configPath);
        // deploy implementations
        deployImplementations(_domain);
        updateImplementations(_domain, _configPath);
        // initialize implementations
        initializeImplementations(_domain);
        // generate governance actions to upgrade
        upgrade(_domain);
        // generate governance actions for Rotate Updater
        setUpdater();
        // generate governance actions to Enroll Replicas
        enrollReplicas();
        // execute governance actions
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(_domain)),
            getDomainNumber(_domain)
        );
    }
}
