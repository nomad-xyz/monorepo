// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// test imports
import {GovernanceRouterHarness} from "./harnesses/GovernanceRouterHarness.sol";
import {GovernanceRouter} from "../governance/GovernanceRouter.sol";
import {GoodXappSimple} from "./utils/GoodXapps.sol";
import "forge-std/Test.sol";

// external imports
import {GovernanceMessage} from "../governance/GovernanceMessage.sol";
import {MockXAppConnectionManager} from "./utils/MockXAppConnectionManager.sol";
import {MockHome} from "@nomad-xyz/contracts-bridge/contracts/test/utils/MockHome.sol";
import {NomadTest} from "./utils/NomadTest.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {TypeCasts} from "../libs/TypeCasts.sol";

contract GovernanceRouterTest is NomadTest {
    using GovernanceMessage for bytes29;
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using TypeCasts for address;
    using TypeCasts for bytes32;

    GovernanceRouterHarness governanceRouter;
    MockHome mockHome;
    MockXAppConnectionManager xAppConnectionManager;
    GoodXappSimple goodXapp;

    uint256 timelock = 24 * 60 * 60;
    address recoveryManager;

    GovernanceMessage.Call[] calls;
    bytes32 callsBatchHash;

    uint32 handleOrigin;
    bytes32 handleSender;
    bytes handleMessage;

    bytes32 remoteGovernanceRouter;
    uint32 remoteGovernanceDomain; // TODO: survey places this is used
    address remoteDomainReplica;

    event TransferGovernor(
        uint32 previousGovernorDomain,
        uint32 newGovernorDomain,
        address indexed previousGovernor,
        address indexed newGovernor
    );

    function setUp() public virtual override {
        recoveryManager = vm.addr(42);

        homeDomain = 1000;
        remoteDomain = 1500;

        remoteDomainReplica = vm.addr(999);

        mockHome = new MockHome(homeDomain);

        xAppConnectionManager = new MockXAppConnectionManager(
            address(mockHome)
        );
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

    //    function test_handleOnlyReplica() public {
    //        // Create test handle
    //        handleOrigin = remoteDomain;
    //        handleSender = remoteGovernanceRouter;
    //        handleMessage = "data";
    //        governanceRouter.exposed_setRemoteGovernor(
    //            remoteGovernanceDomain,
    //            remoteGovernanceRouter
    //        );
    //        xAppConnectionManager.setIsReplica(false);
    //        vm.expectRevert("!replica");
    //        vm.prank(vm.addr(789));
    //        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    //        // in unit tests, simply make mock connection manager return true
    //        // TODO: revert in fork mode
    //        xAppConnectionManager.setIsReplica(true);
    //        // in fork tests, prank an actual replica
    //        vm.prank(remoteDomainReplica);
    //        // We expect to revert cause the handleMessage is rubbish, but it
    //        // passed the onlyReplica modifier, which is what we test here
    //        vm.expectRevert("!valid message type");
    //        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    //    }

    //    function test_handleOnlyGovernorRouter() public {
    //        handleOrigin = remoteDomain;
    //        handleSender = remoteGovernanceRouter;
    //        handleMessage = "data";
    //        xAppConnectionManager.setIsReplica(true);
    //        vm.expectRevert("!governorRouter");
    //        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    //        governanceRouter.exposed_setRemoteGovernor(
    //            remoteGovernanceDomain,
    //            remoteGovernanceRouter
    //        );
    //        // We expect to revert cause the handleMessage is rubbish, but it
    //        // passed the onlyReplica modifier, which is what we test here
    //        vm.expectRevert("!valid message type");
    //        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    //    }

    event BatchReceived(bytes32 indexed batchHash);

    //    function test_handleBatchCorrectForm() public {
    //        // Create test batch for tests
    //        address to = address(0xBEEF);
    //        bytes memory data = "";
    //        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
    //        callsBatchHash = GovernanceMessage.getBatchHash(calls);
    //        // Create test handle
    //        handleOrigin = remoteDomain;
    //        handleSender = remoteGovernanceRouter;
    //        handleMessage = GovernanceMessage.formatBatch(calls);
    //        governanceRouter.exposed_setRemoteGovernor(
    //            remoteGovernanceDomain,
    //            remoteGovernanceRouter
    //        );
    //        vm.expectEmit(true, false, false, false);
    //        emit BatchReceived(callsBatchHash);
    //        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    //    }

    //    function test_handleBatchCorrectFormFuzzed(
    //        uint32 origin,
    //        bytes32 sender,
    //        bytes memory data
    //    ) public {
    //        // Create test batch for tests
    //        vm.assume(origin != homeDomain && sender != bytes32(0) && origin != 0);
    //        address to = address(0xBEEF);
    //        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
    //        callsBatchHash = GovernanceMessage.getBatchHash(calls);
    //        // Create test handle
    //        handleOrigin = origin;
    //        handleSender = sender;
    //        handleMessage = GovernanceMessage.formatBatch(calls);
    //        governanceRouter.exposed_setRemoteGovernor(origin, sender);
    //        vm.expectEmit(true, false, false, false);
    //        emit BatchReceived(callsBatchHash);
    //        governanceRouter.handle(handleOrigin, 0, handleSender, handleMessage);
    //    }

    // TODO: IN FORK MODE, ETHEREUM IS THE GOVERNOR DOMAIN, SO IT WILL REJECT
    // ANY INCOMING TRANSFER GOVERNOR CALLS WITH "!governorRouter"
    // possible solutions:
    //    if homeDomain == governorDomain, skip test
    //    if homeDomain == governorDomain, transfer governor to remoteDomain to begin test
    // NOTE: also a problem for fork tests if homeDomain is not governorDomain AND remoteDomain is not governorDomain
    //    function test_handleTransferGovernorLocalDomainCorrectForm() public {
    //        // Create test handle
    //        handleMessage = GovernanceMessage.formatTransferGovernor(
    //            homeDomain,
    //            address(this).addressToBytes32()
    //        );
    //        vm.expectEmit(true, false, false, false);
    //        emit TransferGovernor(
    //            governanceRouter.governorDomain(),
    //            homeDomain,
    //                governanceRouter.governor(),
    //            address(this)
    //        );
    //        vm.prank(remoteDomainReplica);
    //        governanceRouter.handle(remoteDomain, 0, remoteGovernanceRouter, handleMessage);
    //    }

    //    function test_handleTransferGovernorLocalDomainCorrectFormFuzzed(
    //        uint32 origin,
    //        bytes32 sender
    //    ) public {
    //        // Create test handle
    //        vm.assume(origin != homeDomain && sender != bytes32(0) && origin != 0);
    //        governanceRouter.exposed_setRemoteGovernor(origin, sender);
    //        handleMessage = GovernanceMessage.formatTransferGovernor(
    //            homeDomain,
    //            address(this).addressToBytes32()
    //        );
    //        vm.expectEmit(true, false, false, false);
    //        emit TransferGovernor(
    //            governanceRouter.governorDomain(),
    //            homeDomain,
    //                governanceRouter.governor(),
    //            address(this)
    //        );
    //        governanceRouter.handle(origin, 0, sender, handleMessage);
    //    }

    function test_executeGovernanceActionsNotRecoveryOnlyGovernor() public {
        if (governanceRouter.inRecovery()) exitRecovery();
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

    function test_executeGovernanceActionsIncorrectLength() public {
        if (governanceRouter.inRecovery()) {
            vm.prank(recoveryManager);
        } else {
            vm.prank(governanceRouter.governor());
        }
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
    }

    function test_executeLocalGovernanceActionsRecoveryOnlyRecoveryManager()
        public
    {
        if (!governanceRouter.inRecovery()) enterRecovery();
        // construct calls
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](0);
        uint32[] memory domains = new uint32[](0);
        // fails when not called by recoveryManager
        vm.prank(address(0xBEEF));
        vm.expectRevert("! called by recovery manager");
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        // succeeds when called by recovery manager
        vm.prank(recoveryManager);
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsRecoveryNotRemoteCalls() public {
        if (!governanceRouter.inRecovery()) enterRecovery();
        // construct calls
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](0);
        uint32[] memory remoteDomains = new uint32[](1);
        remoteDomains[0] = remoteDomain;
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        remoteCalls[0] = new GovernanceMessage.Call[](1);
        bytes32 to = remoteGovernanceRouter;
        bytes memory data = hex"BEEF";
        remoteCalls[0][0] = GovernanceMessage.Call(to, data);
        // fails because remote calls are included while in recovery
        vm.prank(recoveryManager);
        vm.expectRevert("!remote calls in recovery mode");
        governanceRouter.executeGovernanceActions(
            localCalls,
            remoteDomains,
            remoteCalls
        );
    }

    //    function test_executeGovernanceActionsOnlyLocal() public {
    //        if (governanceRouter.inRecovery()) {
    //            vm.prank(recoveryManager);
    //        } else {
    //            vm.prank(governanceRouter.governor());
    //        }
    //        GovernanceMessage.Call[]
    //            memory localCalls = new GovernanceMessage.Call[](1);
    //        GovernanceMessage.Call[][]
    //            memory remoteCalls = new GovernanceMessage.Call[][](0);
    //        uint32[] memory domains = new uint32[](0);
    //        bytes32 to = address(goodXapp).addressToBytes32();
    //        bytes memory data = abi.encodeWithSignature("setNumber(uint256)", 55);
    //        localCalls[0] = GovernanceMessage.Call(to, data);
    //        governanceRouter.executeGovernanceActions(
    //            localCalls,
    //            domains,
    //            remoteCalls
    //        );
    //        assertEq(goodXapp.number(), 55);
    //    }

    //    function test_executeGovernanceActionsOnlyRemote() public {
    //        if(governanceRouter.inRecovery()) exitRecovery();
    //        vm.prank(governanceRouter.governor());
    //        // construct remote calls
    //        GovernanceMessage.Call[]
    //            memory localCalls = new GovernanceMessage.Call[](0);
    //        uint32[] memory remoteDomains = new uint32[](1);
    //        remoteDomains[0] = remoteDomain;
    //        GovernanceMessage.Call[][]
    //            memory remoteCalls = new GovernanceMessage.Call[][](1);
    //        remoteCalls[0] = new GovernanceMessage.Call[](1);
    //        bytes32 to = remoteGovernanceRouter;
    //        bytes memory data = hex"BEEF";
    //        remoteCalls[0][0] = GovernanceMessage.Call(to, data);
    //        // TODO fix expect emit for fork
    //        vm.expectEmit(true, true, true, true);
    //        emit Dispatch(
    //            hex"c1c967c7dda92cf93f914728abddd29f35d0233d615a73e40b109ae83d754596",
    //            0,
    //            6442450944000,
    //            hex"0000000000000000000000000000000000000000000000000000000000000000",
    //            hex"000003e8000000000000000000000000efc56627233b02ea95bae7e19f648d7dcd5bb13200000000000005dc000000000000000000000000e2c4a295d6a0daa455a5d49f30b881e69165da8f016b9f965bbbc465cc219497bb8fecc464d76985a15aab0d52f7f20481705cd1dd"
    //        );
    //        governanceRouter.executeGovernanceActions(
    //            localCalls,
    //                remoteDomains,
    //            remoteCalls
    //        );
    //    }

    //    function test_executeGovernanceActionsLocalAndRemote() public {
    //        GovernanceMessage.Call[]
    //            memory localCalls = new GovernanceMessage.Call[](2);
    //        GovernanceMessage.Call[][]
    //            memory remoteCalls = new GovernanceMessage.Call[][](1);
    //        remoteCalls[0] = new GovernanceMessage.Call[](1);
    //        uint32[] memory domains = new uint32[](1);
    //        bytes32 to = remoteGovernanceRouter;
    //        bytes memory data = hex"BEEF";
    //        remoteCalls[0][0] = GovernanceMessage.Call(to, data);
    //        domains[0] = remoteDomain;
    //        to = address(goodXapp).addressToBytes32();
    //        data = abi.encodeWithSignature("setNumber(uint256)", 55);
    //        localCalls[0] = GovernanceMessage.Call(to, data);
    //        // TODO: expect remote dispatch event
    //        governanceRouter.executeGovernanceActions(
    //            localCalls,
    //            domains,
    //            remoteCalls
    //        );
    //        assertEq(goodXapp.number(), 55);
    //    }

    //    // oof
    //    function test_executeGovernanceActionsLocalAndRemoteFuzzed(
    //        bytes[64] memory data,
    //        bytes32[64] memory to,
    //        bytes32[64] memory router,
    //        uint32[64] memory dom,
    //        uint256[64] memory numbers
    //    ) public {
    //        if(governanceRouter.inRecovery()) exitRecovery();
    //        vm.prank(governanceRouter.governor());
    //        GovernanceMessage.Call[]
    //            memory localCalls = new GovernanceMessage.Call[](64);
    //        GovernanceMessage.Call[][]
    //            memory remoteCalls = new GovernanceMessage.Call[][](64);
    //        uint32[] memory domains = new uint32[](64);
    //        for (uint256 i; i < 64; i++) {
    //            if (dom[i] == homeDomain) {
    //                dom[i] = dom[i] + 1;
    //            }
    //            if (router[i] == bytes32(0)) {
    //                router[i] = "non empty address";
    //            }
    //            governanceRouter.setRouterLocal(dom[i], router[i]);
    //            remoteCalls[i] = new GovernanceMessage.Call[](64);
    //            domains[i] = dom[i];
    //            for (uint256 j; j < 64; j++) {
    //                remoteCalls[i][j] = GovernanceMessage.Call(to[i], data[i]);
    //            }
    //            data[i] = abi.encodeWithSignature("setNumber(uint256)", numbers[i]);
    //            localCalls[i] = GovernanceMessage.Call(
    //                address(goodXapp).addressToBytes32(),
    //                data[i]
    //            );
    //        }
    //        governanceRouter.executeGovernanceActions(
    //            localCalls,
    //            domains,
    //            remoteCalls
    //        );
    //        assertEq(goodXapp.number(), numbers[63]);
    //    }

    // TODO: mock Home expectDispatchEvent doesn't work for fork
    //    function test_callRemoteOnlyGovernor() public {
    //        GovernanceMessage.Call[]
    //            memory remoteCalls = new GovernanceMessage.Call[](1);
    //        bytes32 to = remoteGovernanceRouter;
    //        bytes memory data = "Miami";
    //        remoteCalls[0] = GovernanceMessage.Call(to, data);
    //        vm.prank(address(0xBEEF));
    //        string memory revertMessage;
    //        if (governanceRouter.inRecovery()) {
    //            revertMessage = "! called by recovery manager";
    //        } else {
    //            revertMessage = "! called by governor";
    //        }
    //        vm.expectRevert(revertMessage);
    //        governanceRouter.exposed_callRemote(remoteDomain, remoteCalls);
    //        vm.expectEmit(true, true, true, true);
    //        mockHome.hack_expectDispatchEvent(
    //            remoteDomain,
    //            to,
    //            GovernanceMessage.formatBatch(remoteCalls),
    //            address(governanceRouter)
    //        );
    //    }

    function test_callRemoteSuccess() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.prank(governanceRouter.governor());
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](0);
        uint32[] memory remoteDomains = new uint32[](1);
        remoteDomains[0] = remoteDomain;
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        remoteCalls[0] = new GovernanceMessage.Call[](1);
        bytes32 to = remoteGovernanceRouter;
        bytes memory data = hex"BEEF";
        remoteCalls[0][0] = GovernanceMessage.Call(to, data);
        governanceRouter.executeGovernanceActions(
            localCalls,
            remoteDomains,
            remoteCalls
        );
    }

    // TODO what's going on in this test..
    //    function test_callRemoteOnlyGovernorNotInRecovery() public {
    //        if(!governanceRouter.inRecovery()) enterRecovery();
    //
    //        uint32 dest = remoteDomain;
    //        GovernanceMessage.Call[]
    //            memory remoteCalls = new GovernanceMessage.Call[](1);
    //        bytes32 to = remoteGovernanceRouter;
    //        bytes memory data = "Miami";
    //        remoteCalls[0] = GovernanceMessage.Call(to, data);
    //        vm.expectRevert("in recovery");
    //        governanceRouter.exposed_callRemote(dest, remoteCalls);
    //    }

    //    function test_callRemoteWithRouterSuccessFuzzed(
    //        uint32 dest,
    //        bytes32 router,
    //        bytes32[64] memory to,
    //        bytes[64] memory data
    //    ) public {
    //        vm.assume(router != bytes32(0) && dest != homeDomain);
    //        if (governanceRouter.inRecovery()) exitRecovery();
    //        vm.prank(governanceRouter.governor());
    //        governanceRouter.setRouterLocal(dest, router);
    //        GovernanceMessage.Call[] memory localCalls = new GovernanceMessage.Call[](0);
    //        uint32[] memory remoteDomains = new uint32[](1);
    //        GovernanceMessage.Call[][]memory remoteCalls = new GovernanceMessage.Call[][](1);
    //        remoteCalls[0] = new GovernanceMessage.Call[](64);
    //        for (uint256 i; i < 64; i++) {
    //            remoteCalls[0][i] = GovernanceMessage.Call(to[i], data[i]);
    //        }
    //        governanceRouter.executeGovernanceActions(localCalls, remoteDomains, remoteCalls);
    //    }

    // reverts if no remote router enrolled
    //    function test_callRemoteNoRouterRevertsFuzzed(
    //        uint32 dest,
    //        bytes32 router,
    //        bytes32[16] memory to,
    //        bytes[16] memory data
    //    ) public {
    //        vm.assume(
    //            router != bytes32(0) && dest != homeDomain && dest != remoteDomain
    //        );
    //        GovernanceMessage.Call[]
    //            memory remoteCalls = new GovernanceMessage.Call[](16);
    //        for (uint256 i; i < 16; i++) {
    //            remoteCalls[i] = GovernanceMessage.Call(to[i], data[i]);
    //        }
    //        vm.expectRevert("!router");
    //        governanceRouter.exposed_callRemote(dest, remoteCalls);
    //    }

    function test_transferGovernorOnlyGovernor() public {
        address newGovernor = vm.addr(9998888999);
        // local
        vm.prank(address(0xBEEFBEEF));
        vm.expectRevert("! called by governor");
        governanceRouter.transferGovernor(homeDomain, newGovernor);
        // remote
        vm.prank(address(0xBEEFBEEF));
        vm.expectRevert("! called by governor");
        governanceRouter.transferGovernor(remoteDomain, newGovernor);
    }

    function test_transferGovernorOnlyNotInRecovery() public {
        if (!governanceRouter.inRecovery()) enterRecovery();
        address newGovernor = vm.addr(9998888999);
        // local
        vm.prank(governanceRouter.governor());
        vm.expectRevert("in recovery");
        governanceRouter.transferGovernor(homeDomain, newGovernor);
        // remote
        vm.prank(governanceRouter.governor());
        vm.expectRevert("in recovery");
        governanceRouter.transferGovernor(remoteDomain, newGovernor);
    }

    // TODO: mock Home expectDispatchEvent doesn't work for fork
    //    function test_transferGovernorRemoteGovernor() public {
    //        vm.prank(governanceRouter.governor());
    //        address newGovernor = vm.addr(9998888999);
    //        vm.expectEmit(true, true, true, true);
    //        emit TransferGovernor(homeDomain, remoteDomain, address(this), address(0));
    //        uint256 length = governanceRouter.hack_domainsLength();
    //        for (uint256 i = 0; i < length; i++) {
    //            if (governanceRouter.domains(i) != uint32(0)) {
    //                vm.expectEmit(true, true, true, true);
    //                mockHome.hack_expectDispatchEvent(
    //                    governanceRouter.domains(i),
    //                    governanceRouter.routers(governanceRouter.domains(i)),
    //                    GovernanceMessage.formatTransferGovernor(
    //                        remoteDomain,
    //                        newGovernor.addressToBytes32()
    //                    ),
    //                    address(governanceRouter)
    //                );
    //            }
    //        }
    //        governanceRouter.transferGovernor(remoteDomain, newGovernor);
    //        assertEq(governanceRouter.governor(), address(0));
    //        assertEq(uint256(governanceRouter.governorDomain()), remoteDomain);
    //    }

    function test_transferGovernorRemoteGovernorMustHaveRouter() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.prank(governanceRouter.governor());
        uint32 newDomain = 123;
        address newGovernor = vm.addr(9998888999);
        vm.expectRevert("!router");
        governanceRouter.transferGovernor(newDomain, newGovernor);
    }

    // TODO: mock Home expectDispatchEvent doesn't work for fork
    //    function test_transferGovernorRemoteGovernorFuzzed(
    //        uint32 newDomain,
    //        address newGovernor,
    //        bytes32 router
    //    ) public {
    //        if(governanceRouter.inRecovery()) exitRecovery();
    //        vm.prank(governanceRouter.governor());
    //        vm.assume(
    //            newDomain != 0 &&
    //                newDomain != homeDomain &&
    //                newDomain != remoteDomain &&
    //                router != bytes32(0)
    //        );
    //        if (newGovernor == address(0)) {
    //            vm.expectRevert("cannot renounce governor");
    //            governanceRouter.transferGovernor(newDomain, newGovernor);
    //            return;
    //        }
    //        governanceRouter.setRouterLocal(newDomain, router);
    //        vm.expectEmit(true, true, true, true);
    //        emit TransferGovernor(homeDomain, newDomain, address(this), address(0));
    //        uint256 length = governanceRouter.hack_domainsLength();
    //        for (uint256 i = 0; i < length; i++) {
    //            if (governanceRouter.domains(i) != uint32(0)) {
    //                vm.expectEmit(true, true, true, true);
    //                mockHome.hack_expectDispatchEvent(
    //                    governanceRouter.domains(i),
    //                    governanceRouter.routers(governanceRouter.domains(i)),
    //                    GovernanceMessage.formatTransferGovernor(
    //                        newDomain,
    //                        newGovernor.addressToBytes32()
    //                    ),
    //                    address(governanceRouter)
    //                );
    //            }
    //        }
    //        governanceRouter.transferGovernor(newDomain, newGovernor);
    //        assertEq(governanceRouter.governor(), address(0));
    //        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    //    }

    // TODO: can't toggle lock for Home in fork mode
    //    function test_transferGovernorLocalGovernor() public {
    //        uint32 newDomain = homeDomain;
    //        address newGovernor = vm.addr(9998888999);
    //        // Lock the dispatch function. If it is called, it will revert.
    //        // This is done so that we can verify that the function call will NOT
    //        // dispatch any messages to mockHome.
    //        mockHome.hack_toggleLock();
    //        vm.expectEmit(true, true, true, true);
    //        emit TransferGovernor(
    //            homeDomain,
    //            newDomain,
    //            address(this),
    //            newGovernor
    //        );
    //        governanceRouter.transferGovernor(newDomain, newGovernor);
    //        assertEq(governanceRouter.governor(), newGovernor);
    //        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    //    }

    // TODO: can't toggle lock for Home in fork mode
    //    function test_transferGovernorLocalGovernorCANNOTRENOUNCE() public {
    //        uint32 newDomain = homeDomain;
    //        address newGovernor = address(0);
    //        // Lock the dispatch function. If it is called, it will revert.
    //        // This is done so that we can verify that the function call will NOT
    //        // dispatch any messages to mockHome.
    //        mockHome.hack_toggleLock();
    //        vm.expectRevert("cannot renounce governor");
    //        governanceRouter.transferGovernor(newDomain, newGovernor);
    //    }

    // TODO: can't toggle lock for Home in fork mode
    //    function test_transferGovernorLocalGovernorFuzzed(address newGovernor)
    //        public
    //    {
    //        vm.prank(governanceRouter.governor());
    //        uint32 newDomain = homeDomain;
    //        if (newGovernor == address(0)) {
    //            vm.expectRevert("cannot renounce governor");
    //            governanceRouter.transferGovernor(newDomain, newGovernor);
    //            return;
    //        }
    //        mockHome.hack_toggleLock();
    //        vm.expectEmit(true, true, true, true);
    //        emit TransferGovernor(
    //            homeDomain,
    //            newDomain,
    //            address(this),
    //            newGovernor
    //        );
    //        governanceRouter.transferGovernor(newDomain, newGovernor);
    //        assertEq(governanceRouter.governor(), newGovernor);
    //        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    //    }

    function test_transferRecoveryManagerOnlyRecoveryManager() public {
        address newRecoveryManager = address(0xBEEF);
        vm.expectRevert("! called by recovery manager");
        governanceRouter.transferRecoveryManager(newRecoveryManager);
        vm.startPrank(recoveryManager);
        vm.expectEmit(true, true, false, false);
        emit TransferRecoveryManager(recoveryManager, newRecoveryManager);
        governanceRouter.transferRecoveryManager(newRecoveryManager);
        assertEq(governanceRouter.recoveryManager(), newRecoveryManager);
    }

    event TransferRecoveryManager(
        address indexed previousRecoveryManager,
        address indexed newRecoveryManager
    );

    function test_transferRecoveryManagerFuzzed(address newRecoveryManager)
        public
    {
        vm.startPrank(recoveryManager);
        vm.expectEmit(true, true, false, false);
        emit TransferRecoveryManager(
            governanceRouter.recoveryManager(),
            newRecoveryManager
        );
        governanceRouter.transferRecoveryManager(newRecoveryManager);
        assertEq(governanceRouter.recoveryManager(), newRecoveryManager);
    }

    function test_setRouterGlobalOnlyGovernor() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("! called by governor");
        uint32 domain = 123;
        bytes32 router = "router";
        governanceRouter.setRouterGlobal(domain, router);
    }

    function test_setRouterGlobalNotInRecovery() public {
        if (!governanceRouter.inRecovery()) enterRecovery();
        vm.prank(governanceRouter.governor());
        uint32 domain = 123;
        bytes32 router = "router";
        vm.expectRevert("in recovery");
        governanceRouter.setRouterGlobal(domain, router);
    }

    event SetRouter(
        uint32 indexed domain,
        bytes32 previousRouter,
        bytes32 newRouter
    );

    // TODO: mock Home expectDispatchEvent doesn't work for fork
    //    function test_setRouterGlobalNewDomain() public {
    //        uint32 domain = 123;
    //        bytes32 newRouter = "router";
    //        bytes32 previousRouter = governanceRouter.routers(domain);
    //        GovernanceMessage.Call[]
    //            memory remoteCalls = new GovernanceMessage.Call[](1);
    //        remoteCalls[0].data = abi.encodeWithSignature(
    //            "setRouterLocal(uint32,bytes32)",
    //            domain,
    //            newRouter
    //        );
    //        uint256 length = governanceRouter.hack_domainsLength();
    //        for (uint256 i; i < length; i++) {
    //            uint32 dest = governanceRouter.domains(i);
    //            assert(dest != 0);
    //            bytes32 recipient = governanceRouter.routers(dest);
    //            remoteCalls[0].to = recipient;
    //            bytes memory message = GovernanceMessage.formatBatch(remoteCalls);
    //            vm.expectEmit(true, true, true, true);
    //            mockHome.hack_expectDispatchEvent(
    //                dest,
    //                recipient,
    //                message,
    //                address(governanceRouter)
    //            );
    //        }
    //        vm.expectEmit(true, false, false, true);
    //        emit SetRouter(domain, previousRouter, newRouter);
    //        governanceRouter.setRouterGlobal(domain, newRouter);
    //    }

    // TODO: mock Home expectDispatchEvent doesn't work for fork
    //    function test_setRouterGlobalNewDomainFuzzed(
    //        uint32 domain,
    //        bytes32 newRouter
    //    ) public {
    //        vm.assume(domain != homeDomain && domain != 0);
    //        bytes32 previousRouter = governanceRouter.routers(domain);
    //        GovernanceMessage.Call[]
    //            memory remoteCalls = new GovernanceMessage.Call[](1);
    //        remoteCalls[0].data = abi.encodeWithSignature(
    //            "setRouterLocal(uint32,bytes32)",
    //            domain,
    //            newRouter
    //        );
    //        uint256 length = governanceRouter.hack_domainsLength();
    //        for (uint256 i; i < length; i++) {
    //            uint32 dest = governanceRouter.domains(i);
    //            assert(dest != 0);
    //            bytes32 recipient = governanceRouter.routers(dest);
    //            remoteCalls[0].to = recipient;
    //            bytes memory message = GovernanceMessage.formatBatch(remoteCalls);
    //            vm.expectEmit(true, true, true, true);
    //            mockHome.hack_expectDispatchEvent(
    //                dest,
    //                recipient,
    //                message,
    //                address(governanceRouter)
    //            );
    //        }
    //        vm.expectEmit(true, false, false, true);
    //        emit SetRouter(domain, previousRouter, newRouter);
    //        governanceRouter.setRouterGlobal(domain, newRouter);
    //    }

    function test_setRouterGlobaExistinglDomainHome() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.prank(governanceRouter.governor());
        bytes32 newRouter = "new router";
        vm.expectRevert("can't set local router");
        governanceRouter.setRouterGlobal(homeDomain, newRouter);
    }

    // TODO: mock Home expectDispatchEvent doesn't work for fork
    //    function test_setRouterGlobaExistinglDomainRemote() public {
    //        uint32 domain = remoteDomain;
    //        bytes32 newRouter = "new router";
    //        bytes32 previousRouter = governanceRouter.routers(domain);
    //        GovernanceMessage.Call[]
    //            memory remoteCalls = new GovernanceMessage.Call[](1);
    //        remoteCalls[0].data = abi.encodeWithSignature(
    //            "setRouterLocal(uint32,bytes32)",
    //            domain,
    //            newRouter
    //        );
    //        uint256 length = governanceRouter.hack_domainsLength();
    //        for (uint256 i; i < length; i++) {
    //            uint32 dest = governanceRouter.domains(i);
    //            assert(dest != 0);
    //            bytes32 recipient = governanceRouter.routers(dest);
    //            remoteCalls[0].to = recipient;
    //            bytes memory message = GovernanceMessage.formatBatch(remoteCalls);
    //            vm.expectEmit(true, true, true, true);
    //            mockHome.hack_expectDispatchEvent(
    //                dest,
    //                recipient,
    //                message,
    //                address(governanceRouter)
    //            );
    //        }
    //        vm.expectEmit(true, false, false, true);
    //        emit SetRouter(domain, previousRouter, newRouter);
    //        governanceRouter.setRouterGlobal(domain, newRouter);
    //    }

    function test_setXAppConnectionManagerOnlyGovernor() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        MockHome newHome = new MockHome(homeDomain);
        MockXAppConnectionManager newMngr = new MockXAppConnectionManager(
            address(newHome)
        );
        // fails when not governor
        vm.prank(address(0xBEEEEEEEEEEEF));
        vm.expectRevert("! called by governor");
        governanceRouter.setXAppConnectionManager(address(newMngr));
        // succeeds when governor
        vm.prank(governanceRouter.governor());
        governanceRouter.setXAppConnectionManager(address(newMngr));
        assertEq(
            address(governanceRouter.xAppConnectionManager()),
            address(newMngr)
        );
    }

    function test_setXAppConnectionManagerOnlyRecoveryManager() public {
        if (!governanceRouter.inRecovery()) enterRecovery();
        MockHome newHome = new MockHome(homeDomain);
        MockXAppConnectionManager newMngr = new MockXAppConnectionManager(
            address(newHome)
        );
        // fail from random address
        vm.prank(address(0xBEEEEEEEEEEEF));
        vm.expectRevert("! called by recovery manager");
        governanceRouter.setXAppConnectionManager(address(newMngr));
        // succeed from recovery manager
        vm.prank(governanceRouter.recoveryManager());
        governanceRouter.setXAppConnectionManager(address(newMngr));
        assertEq(
            address(governanceRouter.xAppConnectionManager()),
            address(newMngr)
        );
    }

    function test_initiateRecoveryTimeLockOnlyNotInRecovery() public {
        if (!governanceRouter.inRecovery()) enterRecovery();
        vm.prank(recoveryManager);
        vm.expectRevert("in recovery");
        governanceRouter.initiateRecoveryTimelock();
    }

    event InitiateRecovery(
        address indexed recoveryManager,
        uint256 recoveryActiveAt
    );

    function test_initiateRecoveryTimeLockOnlyRecoveryManager() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.expectRevert("! called by recovery manager");
        governanceRouter.initiateRecoveryTimelock();
    }

    event ExitRecovery(address recoveryManager);

    function test_exitRecoveryOnlyRecoveryManager() public {
        if (!governanceRouter.inRecovery()) enterRecovery();
        // fails when not called by recovery manager
        vm.expectRevert("! called by recovery manager");
        governanceRouter.exitRecovery();
        // succeeds when called by recovery manager
        vm.prank(recoveryManager);
        vm.expectEmit(false, false, false, true);
        emit ExitRecovery(recoveryManager);
        governanceRouter.exitRecovery();
        // successfully exits recovery
        assertFalse(governanceRouter.inRecovery());
    }

    function test_exitRecoveryNotInitiatedRevert() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.prank(recoveryManager);
        vm.expectRevert("recovery not initiated");
        governanceRouter.exitRecovery();
    }

    function test_handleBatchNotBatchTypeRevert() public {
        bytes memory batch = bytes("something");
        vm.expectRevert(
            "Type assertion failed. Got 0x0000000002. Expected 0x0000000001"
        );
        governanceRouter.exposed_handleBatch(batch, 2);
    }

    function test_handleBatchMalformedBatch() public {
        // The view is of correct type, but the underlying bytes array
        // is not correctly formatted
        bytes memory batch = bytes("something");
        vm.expectRevert(
            "TypedMemView/index - Overran the view. Slice is at 0x0000a0 with length 0x000009. Attempted to index at offset 0x000001 with length 0x000020."
        );
        governanceRouter.exposed_handleBatch(batch, 1);
    }

    function test_handleBatchSuccess() public {
        address to = address(0xBEEF);
        bytes memory data = "";
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        bytes memory message = GovernanceMessage.formatBatch(calls);
        bytes32 hash = GovernanceMessage.getBatchHash(calls);
        vm.expectEmit(true, false, false, false);
        emit BatchReceived(hash);
        governanceRouter.exposed_handleBatch(message, 1);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Pending)
        );
    }

    function test_handleBatchSuccessFuzzed(address to, bytes memory data)
        public
    {
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        bytes memory message = GovernanceMessage.formatBatch(calls);
        bytes32 hash = GovernanceMessage.getBatchHash(calls);
        vm.expectEmit(true, false, false, false);
        emit BatchReceived(hash);
        governanceRouter.exposed_handleBatch(message, 1);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Pending)
        );
    }

    function test_executeCallBatchRevertNotPending() public {
        address to = address(0xBEEF);
        bytes memory data = "";
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        bytes32 hash = GovernanceMessage.getBatchHash(calls);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Unknown)
        );
        vm.expectRevert("!batch pending");
        governanceRouter.executeCallBatch(calls);
    }

    function test_executeCallBatchRevertNotPendingFuzzed(
        address to,
        bytes memory data
    ) public {
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        bytes32 hash = GovernanceMessage.getBatchHash(calls);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Unknown)
        );
        vm.expectRevert("!batch pending");
        governanceRouter.executeCallBatch(calls);
    }

    event BatchExecuted(bytes32 indexed batchHash);

    function test_executeCallBatchRandomTargetAndCalldataSuccess() public {
        address to = vm.addr(9042332);
        bytes memory data = "";
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        bytes memory message = GovernanceMessage.formatBatch(calls);
        bytes32 hash = GovernanceMessage.getBatchHash(calls);
        // set batch to pending
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Unknown)
        );
        governanceRouter.exposed_handleBatch(message, 1);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Pending)
        );
        vm.expectEmit(true, false, false, false);
        emit BatchExecuted(hash);
        governanceRouter.executeCallBatch(calls);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Complete)
        );
    }

    /// @notice It reverts because there is a very low propability that the target
    /// will be a contract that exists in the testing suite AND that the calldata
    /// will concern a function that eventually reverts.
    function test_executeCallBatchSuccessRandomTargetAndCalldataFuzzed(
        bytes memory data
    ) public {
        address to = address(0xBEEF);
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        bytes memory message = GovernanceMessage.formatBatch(calls);
        bytes32 hash = GovernanceMessage.getBatchHash(calls);
        // set batch to pending
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Unknown)
        );
        governanceRouter.exposed_handleBatch(message, 1);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Pending)
        );
        vm.expectEmit(true, false, false, false);
        emit BatchExecuted(hash);
        governanceRouter.executeCallBatch(calls);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Complete)
        );
    }

    //    function test_executeCallBatchSuccessTargetReverts() public {
    //        address to = address(goodXapp);
    //        bytes memory data = abi.encodeWithSignature("itReverts()");
    //        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
    //        bytes memory message = GovernanceMessage.formatBatch(calls);
    //        bytes32 hash = GovernanceMessage.getBatchHash(calls);
    //        // at first, batch does not exist
    //        assertEq(
    //            uint256(governanceRouter.inboundCallBatches(hash)),
    //            uint256(GovernanceRouter.BatchStatus.Unknown)
    //        );
    //        // after handling the message, batch is pending
    //        governanceRouter.exposed_handleBatch(message, 1);
    //        assertEq(
    //            uint256(governanceRouter.inboundCallBatches(hash)),
    //            uint256(GovernanceRouter.BatchStatus.Pending)
    //        );
    //        // batch cannot be executed because it will revert
    //        vm.expectRevert("call failed");
    //        governanceRouter.executeCallBatch(calls);
    //        // since the call failed, the batch is still pending
    //        assertEq(
    //            uint256(governanceRouter.inboundCallBatches(hash)),
    //            uint256(GovernanceRouter.BatchStatus.Pending)
    //        );
    //    }

    // _transferGovernor() is tested via the public function transferGovernor()

    function test_setRouterRevertLocalDomain() public {
        vm.expectRevert("can't set local router");
        governanceRouter.exposed_setRouter(homeDomain, bytes32("sfd"));
    }

    function test_setRouterNewDomain() public {
        uint32 newDomain = 13;
        bytes32 newRouter = "AFDDF";
        bytes32 previousRouter = governanceRouter.routers(newDomain);
        uint256 previousDomainsLength = governanceRouter.hack_domainsLength();
        vm.expectEmit(true, true, true, false);
        emit SetRouter(newDomain, previousRouter, newRouter);
        governanceRouter.exposed_setRouter(newDomain, newRouter);
        assertEq(governanceRouter.routers(newDomain), newRouter);
        assertEq(
            governanceRouter.hack_domainsLength(),
            previousDomainsLength + 1
        );
        assertEq(
            uint256(governanceRouter.domains(previousDomainsLength)),
            newDomain
        );
    }

    //    function test_setRouterExistingDomain() public {
    //        uint32 newDomain = remoteDomain;
    //        bytes32 newRouter = "AFDDF";
    //        bytes32 previousRouter = governanceRouter.routers(newDomain);
    //        uint256 previousDomainsLength = governanceRouter.hack_domainsLength();
    //        vm.expectEmit(true, true, true, false);
    //        emit SetRouter(newDomain, previousRouter, newRouter);
    //        governanceRouter.exposed_setRouter(newDomain, newRouter);
    //        assertEq(governanceRouter.routers(newDomain), newRouter);
    //        // we shouldn't add a new domain, since we set the router of
    //        // an existing domain
    //        assertEq(governanceRouter.hack_domainsLength(), previousDomainsLength);
    //        assertEq(
    //            uint256(governanceRouter.domains(previousDomainsLength - 1)),
    //            newDomain
    //        );
    //    }
    //
    //    function test_setRouterRemoveDomain() public {
    //        // Add another domain so that we have 2 remote domains and the domains array
    //        // is not empited when removing a remote domain. This is needed to test more
    //        // concretely.
    //        bytes32 existingRouter = "asdfasfasdf";
    //        uint32 existingDomain = 23;
    //        governanceRouter.exposed_setRouter(existingDomain, existingRouter);
    //        uint32 newDomain = remoteDomain;
    //        bytes32 newRouter = bytes32(0);
    //        bytes32 previousRouter = governanceRouter.routers(newDomain);
    //        uint256 previousDomainsLength = governanceRouter.hack_domainsLength();
    //        vm.expectEmit(true, true, true, false);
    //        emit SetRouter(newDomain, previousRouter, newRouter);
    //        governanceRouter.exposed_setRouter(newDomain, newRouter);
    //        assertEq(governanceRouter.routers(newDomain), newRouter);
    //        // we remove the domain, since it's router now is bytes32(0)
    //        // removing the domain means that we turn it into 0, but keep it in the array
    //        // [1500, 23] --> [0, 23]
    //        assertEq(governanceRouter.hack_domainsLength(), previousDomainsLength);
    //        assertEq(
    //            uint256(governanceRouter.domains(previousDomainsLength - 1)),
    //            existingDomain
    //        );
    //        assertEq(
    //            uint256(governanceRouter.domains(previousDomainsLength - 2)),
    //            0
    //        );
    //    }

    function test_isGovernorDomain() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.prank(governanceRouter.governor());
        governanceRouter.transferGovernor(
            remoteDomain,
            remoteGovernanceRouter.bytes32ToAddress()
        );
        assert(
            governanceRouter.exposed_isGovernorRouter(
                remoteDomain,
                remoteGovernanceRouter
            )
        );
        assertFalse(
            governanceRouter.exposed_isGovernorRouter(
                remoteDomain,
                address(governanceRouter).addressToBytes32()
            )
        );
        assertFalse(
            governanceRouter.exposed_isGovernorRouter(
                homeDomain,
                address(governanceRouter).addressToBytes32()
            )
        );
        assertFalse(
            governanceRouter.exposed_isGovernorRouter(
                homeDomain,
                remoteGovernanceRouter
            )
        );
    }

    function test_mustHaveRouter() public {
        assertEq(
            governanceRouter.exposed_mustHaveRouter(remoteDomain),
            remoteGovernanceRouter
        );
        vm.expectRevert("!router");
        governanceRouter.exposed_mustHaveRouter(homeDomain);
    }

    /*//////////////////////////////////////////////////////////////
                                UTILITIES
    //////////////////////////////////////////////////////////////*/

    function enterRecovery() public {
        vm.prank(recoveryManager);
        vm.expectEmit(true, false, false, true);
        emit InitiateRecovery(recoveryManager, block.timestamp + timelock);
        governanceRouter.initiateRecoveryTimelock();
        vm.warp(block.timestamp + timelock);
        assert(governanceRouter.inRecovery());
        assertEq(governanceRouter.recoveryActiveAt(), block.timestamp);
    }

    function exitRecovery() public {
        vm.prank(recoveryManager);
        vm.expectEmit(true, false, false, true);
        emit ExitRecovery(recoveryManager);
        governanceRouter.exitRecovery();
        assert(!governanceRouter.inRecovery());
        assertEq(governanceRouter.recoveryActiveAt(), 0);
    }
}
