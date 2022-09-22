// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// test imports
import {GovernanceRouterHarness} from "./harnesses/GovernanceRouterHarness.sol";
import {NomadTest} from "./utils/NomadTest.sol";

// external imports
import {GovernanceMessage} from "../governance/GovernanceMessage.sol";
import {MockXAppConnectionManager} from "./utils/MockXAppConnectionManager.sol";
import {MockHome} from "@nomad-xyz/contracts-bridge/contracts/test/utils/MockHome.sol";

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
    GovernanceRouterHarness governanceRouter;
    MockHome home;
    MockXAppConnectionManager xAppConnectionManager;

    uint256 constant timelock = 24 * 60 * 60;
    address recoveryManager;
    GovernanceMessage.Call _call;

    function setUp() public override {
        super.setUp();
        // configure system addresses
        recoveryManager = vm.addr(42);

        home = new MockHome(homeDomain);
        xAppConnectionManager = new MockXAppConnectionManager(address(home));
        // setup governance router
        governanceRouter = new GovernanceRouterHarness(homeDomain, timelock);
        governanceRouter.initialize(
            address(xAppConnectionManager),
            recoveryManager
        );
        assertEq(governanceRouter.recoveryManager(), recoveryManager);
        assertEq(
            address(governanceRouter.xAppConnectionManager()),
            address(xAppConnectionManager)
        );
    }

    // uint32 _destination, GovernanceMessage.Call[] calldata _calls

    // reverts if no remote router enrolled
    function test_callRemoteNoRouter() public {}

    // emits a single dispatch event for 1 call
    function test_callRemoteOneCall() public {}

    // emits a single dispatch event for multiple calls
    function test_callRemoteMultiCalls() public {}

    // reverts if _call.to is zero
    function test_callLocalZeroAddress() public {}

    // reverts if _call.to is not a contract
    function test_callLocalNotContract() public {}

    // reverts if (_call.to).call(_call.data) reverts
    function test_callLocalRevert() public {}

    // test when call succeeds & takes the effect of the call
    function test_callLocalSuccess() public {}
}
