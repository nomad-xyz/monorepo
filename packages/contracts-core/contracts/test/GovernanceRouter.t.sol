// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// test imports
import {GovernanceRouterHarness} from "./harnesses/GovernanceRouterHarness.sol";
import {NomadTest} from "./utils/NomadTest.sol";
import {GoodXappSimple} from "./utils/GoodXapps.sol";

// external imports
import {GovernanceMessage} from "../governance/GovernanceMessage.sol";
import {MockXAppConnectionManager} from "./utils/MockXAppConnectionManager.sol";
import {MockHome} from "@nomad-xyz/contracts-bridge/contracts/test/utils/MockHome.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {TypeCasts} from "../libs/TypeCasts.sol";

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
    using GovernanceMessage for bytes29;
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using TypeCasts for address;
    using TypeCasts for bytes32;

    GovernanceRouterHarness governanceRouter;
    MockHome home;
    MockXAppConnectionManager xAppConnectionManager;
    GoodXappSimple goodXapp;

    uint256 constant timelock = 24 * 60 * 60;
    address recoveryManager;

    GovernanceMessage.Call[] calls;
    bytes32 callsBatchHash;

    uint32 handleOrigin;
    bytes32 handleSender;
    bytes handleMessage;

    bytes32 remoteGovernanceRouter;
    uint32 remoteGovernanceDomain;

    function setUp() public override {
        super.setUp();

        recoveryManager = vm.addr(42);

        home = new MockHome(homeDomain);
        xAppConnectionManager = new MockXAppConnectionManager(address(home));
        governanceRouter = new GovernanceRouterHarness(homeDomain, timelock);
        // setup governance router
        governanceRouter.initialize(
            address(xAppConnectionManager),
            recoveryManager
        );
        // Set a remote governor router
        remoteGovernanceRouter = vm.addr(420).addressToBytes32();
        remoteGovernanceDomain = remoteDomain;
    }

    event TransferGovernor(
        uint32 previousGovernorDomain,
        uint32 newGovernorDomain,
        address indexed previousGovernor,
        address indexed newGovernor
    );

    function test_initializeCorrectSet() public {
        governanceRouter = new GovernanceRouterHarness(homeDomain, timelock);
        // Test Initialize function
        vm.expectEmit(true, true, false, true);
        emit TransferGovernor(0, homeDomain, address(0), address(this));
        governanceRouter.initialize(
            address(xAppConnectionManager),
            recoveryManager
        );
        assertEq(governanceRouter.recoveryManager(), recoveryManager);
        assertEq(
            address(governanceRouter.xAppConnectionManager()),
            address(xAppConnectionManager)
        );
        assertEq(governanceRouter.governor(), address(this));
        assertEq(uint256(governanceRouter.governorDomain()), homeDomain);
    }

    function test_initializeRevertBadDomain() public {
        //  XAppConnectionManager has been setup with domain = homeDomain
        governanceRouter = new GovernanceRouterHarness(remoteDomain, timelock);
        vm.expectRevert("XAppConnectionManager bad domain");
        governanceRouter.initialize(
            address(xAppConnectionManager),
            recoveryManager
        );
    }

    function test_handleOnlyReplica() public {
        // Create test handle
        handleOrigin = remoteDomain;
        handleSender = remoteGovernanceRouter;
        handleMessage = "data";
        governanceRouter.exposed_setRemoteGovernor(
            remoteGovernanceDomain,
            remoteGovernanceRouter
        );
        xAppConnectionManager.setIsReplica(false);
        vm.expectRevert("!replica");
        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
        xAppConnectionManager.setIsReplica(true);
        // We expect to revert cause the handleMessage is rubbish, but it
        // passed the onlyReplica modifier, which is what we test here
        vm.expectRevert("!valid message type");
        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    }

    function test_handleOnlyGovernorRouter() public {
        handleOrigin = remoteDomain;
        handleSender = remoteGovernanceRouter;
        handleMessage = "data";
        xAppConnectionManager.setIsReplica(true);
        vm.expectRevert("!governorRouter");
        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
        governanceRouter.exposed_setRemoteGovernor(
            remoteGovernanceDomain,
            remoteGovernanceRouter
        );
        // We expect to revert cause the handleMessage is rubbish, but it
        // passed the onlyReplica modifier, which is what we test here
        vm.expectRevert("!valid message type");
        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    }

    event BatchReceived(bytes32 indexed batchHash);

    function test_handleBatchCorrectForm() public {
        // Create test batch for tests
        address to = address(0xBEEF);
        bytes memory data = "";
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        callsBatchHash = GovernanceMessage.getBatchHash(calls);
        // Create test handle
        handleOrigin = remoteDomain;
        handleSender = remoteGovernanceRouter;
        handleMessage = GovernanceMessage.formatBatch(calls);
        governanceRouter.exposed_setRemoteGovernor(
            remoteGovernanceDomain,
            remoteGovernanceRouter
        );
        vm.expectEmit(true, false, false, false);
        emit BatchReceived(callsBatchHash);
        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    }

    function test_handleBatchCorrectFormFuzzed(
        uint32 origin,
        bytes32 sender,
        bytes memory data
    ) public {
        // Create test batch for tests
        address to = address(0xBEEF);
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        callsBatchHash = GovernanceMessage.getBatchHash(calls);
        // Create test handle
        handleOrigin = origin;
        handleSender = sender;
        handleMessage = GovernanceMessage.formatBatch(calls);
        governanceRouter.exposed_setRemoteGovernor(origin, sender);
        vm.expectEmit(true, false, false, false);
        emit BatchReceived(callsBatchHash);
        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    }

    function test_handleTransferGovernorCorrectForm() public {
        // Create test handle
        handleOrigin = remoteDomain;
        handleSender = remoteGovernanceRouter;
        handleMessage = GovernanceMessage.formatTransferGovernor(
            homeDomain,
            address(this).addressToBytes32()
        );
        governanceRouter.exposed_setRemoteGovernor(
            remoteGovernanceDomain,
            remoteGovernanceRouter
        );
        vm.expectEmit(true, false, false, false);
        emit TransferGovernor(
            remoteDomain,
            homeDomain,
            address(0),
            address(this)
        );
        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    }

    function test_handleTransferGovernorCorrectFormFuzzed(
        uint32 origin,
        bytes32 sender
    ) public {
        // Create test handle
        handleOrigin = origin;
        handleSender = sender;
        handleMessage = GovernanceMessage.formatTransferGovernor(
            homeDomain,
            address(this).addressToBytes32()
        );
        governanceRouter.exposed_setRemoteGovernor(origin, sender);
        vm.expectEmit(true, false, false, false);
        emit TransferGovernor(
            remoteDomain,
            homeDomain,
            address(0),
            address(this)
        );
        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
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
