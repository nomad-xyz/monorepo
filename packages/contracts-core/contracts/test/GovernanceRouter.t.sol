// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {GovernanceRouterHarness} from "./harnesses/GovernanceRouterHarness.sol";
import {NomadTest} from "./utils/NomadTest.sol";

/**
// _callRemote

// _callLocal

// handle
	// only replica
	// only governor router
	// batch msg
	// transfer governor msg

    // sets the batch to pending

// executeCallBatch(GovernanceMessage.Call[] calldata _calls)
	// reverts if batch has not been seen
	// reverts if batch has already been executed
    // reverts if any single call reverts
	// succeeds for pending batch with one successful call
	    // sets the batch to executed after
	// succeeds for pending batch with multiple successful calls
        // sets the batch to executed after

// executeGovernanceActions
	// normal
		// onlyGovernor
		// !malformed inputs (domains != remotecalls)
		// callLocal - execute call locally
		// callRemote - emit Dispatch event

		// local call, no remotes
		// remote calls, no locals
		// local and remotes
		// reverts if there are no calls at all
		// reverts if there is mismatched number of remote domains / calls

	// in recovery mode
		// onlyRecoveryManager
		// !remote in recovery mode
*/

contract GovernanceRouterTest is NomadTest {
    GovernanceRouterHarness gov;

    uint256 constant timelock = 24 * 60 * 60;
    address recoveryManager;
    address xAppConnectionManager;
    GovernanceMessage.Call _call;

    function setUp() public override {
        super.setUp();
        // configure system addresses
        recoveryManager = vm.addr(42);
        xAppConnectionManager = vvm.addr(123);
        // setup governance router
        gov = new GovernanceRouterHarness(homeDomain, timelock);
        gov.initialize(xAppConnectionManager, recoveryManager);
        assertEq(router.remotes(newDomain), bytes32(0));
    }

    // uint32 _destination, GovernanceMessage.Call[] calldata _calls

    // reverts if no remote router enrolled
    function test_callRemoteNoRouter() public {
    }

    // emits a single dispatch event for 1 call
    function test_callRemoteOneCall() public {
    }

    // emits a single dispatch event for multiple calls
    function test_callRemoteMultiCalls() public {
    }

    // reverts if _call.to is zero
    function test_callLocalZeroAddress() public {
        _call.to = bytes32(0);
        // TODO: add real data
        _call.data = bytes(0);
        vm.expectRevert("call failed");
        gov.exposed_callLocal(_call);
    }

    // reverts if _call.to is not a contract
    function test_callLocalNotContract() public {
        _call.to = bytes32(address(54321));
        // TODO: add real data
        _call.data = bytes(0);
        vm.expectRevert("call failed");
        gov.exposed_callLocal(_call);
    }

    // reverts if (_call.to).call(_call.data) reverts
    function test_callLocalRevert() public {
        // TODO: add real app
        _call.to = bytes32(address(54321));
        // TODO: add real data for call that reverts
        _call.data = bytes(0);
        vm.expectRevert("call failed");
        gov.exposed_callLocal(_call);
    }

    // test when call succeeds & takes the effect of the call
    function test_callLocalSuccess() public {
        // TODO: add real app
        _call.to = bytes32(address(54321));
        // TODO: add real data for call that succeeds
        _call.data = bytes(0);
        gov.exposed_callLocal(_call);
    }
}
