// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RotateUpdaterLogic} from "../scripts/RotateUpdater.s.sol";
import {EnrollReplicasLogic} from "../scripts/EnrollReplica.s.sol";
import {DeployAccountantLogic} from "../scripts/DeployAccountant.s.sol";
import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";

contract RebootTest is
    Config,
    CallBatch,
    RotateUpdaterLogic,
    EnrollReplicasLogic,
    DeployAccountantLogic,
    Test
{
    function setUp() public {
        __Config_initialize("./actions/config.json");
        __CallBatch_initialize(
            "ethereum",
            getDomainNumber("ethereum"),
            "",
            true
        );
        // deploy accountant contracts
        deployAccountant(localDomainName);
        // TODO: upgrade script
        // generate governance actions for Rotate Updater
        setUpdater();
        assertEq(localCalls.length, 6);
        // generate governance actions to Enroll Replicas
        enrollReplicas();
        assertEq(localCalls.length, 11);
        // execute governance actions
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            localDomain
        );
    }

    function test_setup() public {
        assertEq(
            getUpdater("ethereum"),
            0x499B1Fa18E3CaC1c8cDF2B14C458aA70A6a2B68f
        );
    }
}
