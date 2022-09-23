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

    event Dispatch(
        bytes32 indexed messageHash,
        uint256 indexed leafIndex,
        uint64 indexed destinationAndNonce,
        bytes32 committedRoot,
        bytes message
    );

    event TransferGovernor(
        uint32 previousGovernorDomain,
        uint32 newGovernorDomain,
        address indexed previousGovernor,
        address indexed newGovernor
    );

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
        goodXapp = new GoodXappSimple();

        governanceRouter.setRouterLocal(remoteDomain, remoteGovernanceRouter);
    }

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
        vm.assume(origin != homeDomain);
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
        vm.assume(origin != homeDomain);
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

    function test_executeGovernanceActionsNotRecoveryOnlyGovernor() public {
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        uint32[] memory domains = new uint32[](1);
        vm.prank(address(0xBEEF));
        vm.expectRevert("! called by governor");
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        vm.prank(recoveryManager);
        vm.expectRevert("! called by governor");
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsNotRecoveryIncorrectLength() public {
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        uint32[] memory domains = new uint32[](2);
        vm.expectRevert("!domains length matches calls length");
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        domains = new uint32[](1);
        domains[0] = remoteDomain;
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsRecoveryOnlyRecoverymanager() public {
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](0);
        uint32[] memory domains = new uint32[](0);
        enterRecovery();
        vm.prank(address(0xBEEF));
        vm.expectRevert("! called by recovery manager");
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        vm.prank(recoveryManager);
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsRecoveryNotRemoteCalls() public {
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        uint32[] memory domains = new uint32[](1);
        enterRecovery();
        vm.prank(recoveryManager);
        vm.expectRevert("!remote calls in recovery mode");
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsOnlyLocal() public {
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](0);
        uint32[] memory domains = new uint32[](0);
        bytes32 to = address(goodXapp).addressToBytes32();
        bytes memory data = abi.encodeWithSignature("setNumber(uint256)", 55);
        localCalls[0] = GovernanceMessage.Call(to, data);
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        assertEq(goodXapp.number(), 55);
    }

    function test_executeGovernanceActionsOnlyRemote() public {
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](0);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        remoteCalls[0] = new GovernanceMessage.Call[](1);
        uint32[] memory domains = new uint32[](1);
        bytes32 to = remoteGovernanceRouter;
        bytes memory data = hex"BEEF";
        remoteCalls[0][0] = GovernanceMessage.Call(to, data);
        domains[0] = remoteDomain;
        vm.expectEmit(true, true, true, true);
        emit Dispatch(
            hex"a18f243f7082493adc45a68db56920b2589a4057301363c0b13ffe7756f6ac80",
            0,
            4294967296000,
            hex"0000000000000000000000000000000000000000000000000000000000000000",
            hex"000005dc000000000000000000000000f5a2fe45f4f1308502b1c136b9ef8af13614138200000000000003e8000000000000000000000000e2c4a295d6a0daa455a5d49f30b881e69165da8f016b9f965bbbc465cc219497bb8fecc464d76985a15aab0d52f7f20481705cd1dd"
        );
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsLocalAndRemote() public {
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](2);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        remoteCalls[0] = new GovernanceMessage.Call[](1);
        uint32[] memory domains = new uint32[](1);
        bytes32 to = remoteGovernanceRouter;
        bytes memory data = hex"BEEF";
        remoteCalls[0][0] = GovernanceMessage.Call(to, data);
        domains[0] = remoteDomain;
        to = address(goodXapp).addressToBytes32();
        data = abi.encodeWithSignature("setNumber(uint256)", 55);
        localCalls[0] = GovernanceMessage.Call(to, data);
        vm.expectEmit(true, true, true, true);
        // Directly plug into the mock contract to generate the appropriate event to expect
        home.hack_expectDispatchEvent(
            remoteDomain,
            remoteGovernanceRouter,
            GovernanceMessage.formatBatch(remoteCalls[0]),
            address(governanceRouter)
        );
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        assertEq(goodXapp.number(), 55);
    }

    // oof
    function test_executeGovernanceActionsLocalAndRemoteFuzzed(
        bytes[64] memory data,
        bytes32[64] memory to,
        uint32[64] memory dom,
        uint256[64] memory numbers
    ) public {
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](64);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](64);
        uint32[] memory domains = new uint32[](64);
        for (uint256 i; i < 64; i++) {
            if (dom[i] == homeDomain) {
                dom[i] = dom[i] + 1;
            }
            if (to[i] == bytes32(0)) {
                to[i] = "non empty address";
            }
            governanceRouter.setRouterLocal(dom[i], to[i]);
            remoteCalls[i] = new GovernanceMessage.Call[](64);
            domains[i] = dom[i];
            for (uint256 j; j < 64; j++) {
                remoteCalls[i][j] = GovernanceMessage.Call(to[i], data[i]);
            }
            data[i] = abi.encodeWithSignature("setNumber(uint256)", numbers[i]);
            localCalls[i] = GovernanceMessage.Call(
                address(goodXapp).addressToBytes32(),
                data[i]
            );
        }
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        assertEq(goodXapp.number(), numbers[63]);
    }

    function test_callRemoteOnlyGovernor() public {
        uint32 dest = remoteDomain;
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](1);
        bytes32 to = remoteGovernanceRouter;
        bytes memory data = "Miami";
        calls[0] = GovernanceMessage.Call(to, data);
        vm.prank(address(0xBEEF));
        vm.expectRevert("! called by governor");
        governanceRouter.exposed_callRemote(dest, calls);
        vm.expectEmit(true, true, true, true);
        home.hack_expectDispatchEvent(
            dest,
            to,
            GovernanceMessage.formatBatch(calls),
            address(governanceRouter)
        );
        governanceRouter.exposed_callRemote(dest, calls);
    }

    function test_callRemoteOnlyGovernorNotInRecovery() public {
        uint32 dest = remoteDomain;
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](1);
        bytes32 to = remoteGovernanceRouter;
        bytes memory data = "Miami";
        calls[0] = GovernanceMessage.Call(to, data);
        enterRecovery();
        vm.expectRevert("in recovery");
        governanceRouter.exposed_callRemote(dest, calls);
    }

    function test_callRemoteSuccessFuzzed(
        uint32 dest,
        bytes32 router,
        bytes32[64] memory to,
        bytes[64] memory data
    ) public {
        vm.assume(router != bytes32(0));
        governanceRouter.setRouterLocal(dest, router);
        GovernanceMessage.Call[] memory calls = new GovernanceMessage.Call[](
            64
        );
        for (uint256 i; i < 64; i++) {
            calls[i] = GovernanceMessage.Call(to[i], data[i]);
        }
        bytes32 to = remoteGovernanceRouter;
        governanceRouter.exposed_callRemote(dest, calls);
        vm.expectEmit(true, true, true, true);
        home.hack_expectDispatchEvent(
            dest,
            router,
            GovernanceMessage.formatBatch(calls),
            address(governanceRouter)
        );
        governanceRouter.exposed_callRemote(dest, calls);
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

    function enterRecovery() public {
        vm.prank(recoveryManager);
        governanceRouter.initiateRecoveryTimelock();
        vm.warp(block.timestamp + timelock);
        assert(governanceRouter.inRecovery());
    }
}
