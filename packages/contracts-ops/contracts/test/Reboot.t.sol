// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Script.sol";
import {ReplicaTest} from "@nomad-xyz/contracts-core/contracts/test/Replica.t.sol";
import {RotateUpdaterLogic} from "../scripts/RotateUpdater.s.sol";
import {EnrollReplicasLogic} from "../scripts/EnrollReplica.s.sol";
import {DeployAccountant} from "../scripts/DeployAccountant.s.sol";
import {Config} from "../Config.sol";
import {CallBatch} from "../CallBatch.sol";
import {INomadProtocol} from "../test/utils/INomadProtocol.sol";

// TODO: this is currently not possible because the Config is inherited by all of them. want to figure out how we can refactor to fix this
contract RebootTest is Script, INomadProtocol, Config, CallBatch, RotateUpdaterLogic, EnrollReplicasLogic, DeployAccountant, ReplicaTest {

    function setUp() public override {
        __Config_initialize(configFile);
        __CallBatch_initialize("ethereum", "", true);
        // run reboot scripts
        setUpdater();
        deployAccountant(domain);
        // TODO: upgrade script
        enrollReplicas;
        // execute reboot governance actions
        prankExecuteBatch(address(governanceRouter(domain)));
    }

    /// @notice It should revert because the message is not proven, i.e is not included in the committed Root
    function test_notProcessUnprovenMessage() public {
        setUpExampleProof();
        replica.setCommittedRoot(exampleRoot);
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(uint256(uint160(vm.addr(431))));
        uint32 nonce = 0;
        bytes memory messageBody = "0x";
        bytes memory message = Message.formatMessage(
            remoteDomain,
            sender,
            nonce,
            homeDomain,
            receiver,
            messageBody
        );
        vm.expectRevert("!proven");
        replica.process(message);
    }
}
