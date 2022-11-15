// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
IMPORTS
//////////////////////////////////////////////////////////////*/

// Utilities
import {Script, console2} from "forge-std/Script.sol";

// Ops libs
import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";
import {DeployAccountantLogic} from "./DeployAccountant.s.sol";
import {DeployImplementationsLogic} from "./DeployImplementations.s.sol";
import {InitializeImplementationsLogic} from "./InitializeImplementations.s.sol";
import {UpgradeCallBatchLogic} from "./UpgradeCallBatches.s.sol";
import {RotateUpdaterLogic} from "./RotateUpdater.s.sol";
import {EnrollReplicasLogic} from "./EnrollReplica.s.sol";

// Contract for selector
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";

contract RebootLogic is
    Config,
    CallBatch,
    RotateUpdaterLogic,
    EnrollReplicasLogic,
    DeployAccountantLogic,
    DeployImplementationsLogic,
    InitializeImplementationsLogic,
    UpgradeCallBatchLogic
{
    function reboot(string memory _domain, string memory _configPath) internal {
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
    }
}

contract Reboot is RebootLogic {
    // entrypoint
    function runReboot(
        string memory _configPath,
        string memory _domain,
        string memory _callBatchOutput,
        bool _overwrite
    ) external {
        __Config_initialize(_configPath);
        __CallBatch_initialize(
            _domain,
            getDomainNumber(_domain),
            _callBatchOutput,
            _overwrite
        );
        // perform reboot actions
        reboot(_domain, _configPath);
        // write callbatch
        // note: this is a one-time script which will be run in recovery mode
        writeCallBatch(true);
    }
}
