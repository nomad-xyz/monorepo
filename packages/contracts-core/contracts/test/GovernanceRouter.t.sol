// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// test imports
import {GovernanceRouterHarness} from "./harnesses/GovernanceRouterHarness.sol";
import {GoodXappSimple} from "./utils/GoodXapps.sol";
import "forge-std/Test.sol";

// external imports
import {GovernanceMessage} from "../governance/GovernanceMessage.sol";
import {MockXAppConnectionManager} from "./utils/MockXAppConnectionManager.sol";
import {MockHome} from "@nomad-xyz/contracts-bridge/contracts/test/utils/MockHome.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {TypeCasts} from "../libs/TypeCasts.sol";

contract GovernanceRouterTest is Test {
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

    uint32 homeDomain;
    uint32 remoteDomain;

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

    function setUp() public {
        recoveryManager = vm.addr(42);

        homeDomain = 1000;
        remoteDomain = 1500;

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
            hex"c1c967c7dda92cf93f914728abddd29f35d0233d615a73e40b109ae83d754596",
            0,
            6442450944000,
            hex"0000000000000000000000000000000000000000000000000000000000000000",
            hex"000003e8000000000000000000000000efc56627233b02ea95bae7e19f648d7dcd5bb13200000000000005dc000000000000000000000000e2c4a295d6a0daa455a5d49f30b881e69165da8f016b9f965bbbc465cc219497bb8fecc464d76985a15aab0d52f7f20481705cd1dd"
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
        bytes32[64] memory router,
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
            if (router[i] == bytes32(0)) {
                router[i] = "non empty address";
            }
            governanceRouter.setRouterLocal(dom[i], router[i]);
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
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](1);
        bytes32 to = remoteGovernanceRouter;
        bytes memory data = "Miami";
        remoteCalls[0] = GovernanceMessage.Call(to, data);
        vm.prank(address(0xBEEF));
        vm.expectRevert("! called by governor");
        governanceRouter.exposed_callRemote(dest, remoteCalls);
        vm.expectEmit(true, true, true, true);
        home.hack_expectDispatchEvent(
            dest,
            to,
            GovernanceMessage.formatBatch(remoteCalls),
            address(governanceRouter)
        );
        governanceRouter.exposed_callRemote(dest, remoteCalls);
    }

    function test_callRemoteOnlyGovernorNotInRecovery() public {
        uint32 dest = remoteDomain;
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](1);
        bytes32 to = remoteGovernanceRouter;
        bytes memory data = "Miami";
        remoteCalls[0] = GovernanceMessage.Call(to, data);
        enterRecovery();
        vm.expectRevert("in recovery");
        governanceRouter.exposed_callRemote(dest, remoteCalls);
    }

    function test_callRemoteWithRouterSuccessFuzzed(
        uint32 dest,
        bytes32 router,
        bytes32[64] memory to,
        bytes[64] memory data
    ) public {
        vm.assume(router != bytes32(0) && dest != homeDomain);
        governanceRouter.setRouterLocal(dest, router);
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](64);
        for (uint256 i; i < 64; i++) {
            remoteCalls[i] = GovernanceMessage.Call(to[i], data[i]);
        }
        vm.expectEmit(true, true, true, true);
        home.hack_expectDispatchEvent(
            dest,
            router,
            GovernanceMessage.formatBatch(remoteCalls),
            address(governanceRouter)
        );
        governanceRouter.exposed_callRemote(dest, remoteCalls);
    }

    // reverts if no remote router enrolled
    function test_callRemoteNoRouterRevertsFuzzed(
        uint32 dest,
        bytes32 router,
        bytes32[16] memory to,
        bytes[16] memory data
    ) public {
        vm.assume(
            router != bytes32(0) && dest != homeDomain && dest != remoteDomain
        );
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](16);
        for (uint256 i; i < 16; i++) {
            remoteCalls[i] = GovernanceMessage.Call(to[i], data[i]);
        }
        vm.expectRevert("!router");
        governanceRouter.exposed_callRemote(dest, remoteCalls);
    }

    function test_transferGovernorOnlyGovernor() public {
        uint32 newDomain = 123;
        address newGovernor = vm.addr(9998888999);
        bytes32 router = "router address";
        governanceRouter.setRouterLocal(newDomain, router);
        vm.prank(address(0xBEEF));
        vm.expectRevert("! called by governor");
        governanceRouter.transferGovernor(newDomain, newGovernor);
    }

    function test_transferGovernorOnlyNotInRecovery() public {
        uint32 newDomain = 123;
        address newGovernor = vm.addr(9998888999);
        bytes32 router = "router address";
        governanceRouter.setRouterLocal(newDomain, router);
        enterRecovery();
        vm.expectRevert("in recovery");
        governanceRouter.transferGovernor(newDomain, newGovernor);
    }

    function test_transferGovernorRemoteGovernor() public {
        uint32 newDomain = 123;
        address newGovernor = vm.addr(9998888999);
        bytes32 router = "router address";
        governanceRouter.setRouterLocal(newDomain, router);
        vm.expectEmit(true, true, true, true);
        emit TransferGovernor(homeDomain, newDomain, address(this), address(0));
        uint256 length = governanceRouter.hack_domainsLength();
        for (uint256 i = 0; i < length; i++) {
            if (governanceRouter.domains(i) != uint32(0)) {
                vm.expectEmit(true, true, true, true);
                home.hack_expectDispatchEvent(
                    governanceRouter.domains(i),
                    governanceRouter.routers(governanceRouter.domains(i)),
                    GovernanceMessage.formatTransferGovernor(
                        newDomain,
                        newGovernor.addressToBytes32()
                    ),
                    address(governanceRouter)
                );
            }
        }
        governanceRouter.transferGovernor(newDomain, newGovernor);
        assertEq(governanceRouter.governor(), address(0));
        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    }

    function test_transferGovernorRemoteGovernorFuzzed(
        uint32 newDomain,
        address newGovernor,
        bytes32 router
    ) public {
        vm.assume(
            newDomain != 0 &&
                newDomain != homeDomain &&
                newDomain != remoteDomain
        );
        if (newGovernor == address(0)) {
            vm.expectRevert("cannot renounce governor");
            return;
        }
        governanceRouter.setRouterLocal(newDomain, router);
        vm.expectEmit(true, true, true, true);
        emit TransferGovernor(homeDomain, newDomain, address(this), address(0));
        uint256 length = governanceRouter.hack_domainsLength();
        for (uint256 i = 0; i < length; i++) {
            if (governanceRouter.domains(i) != uint32(0)) {
                vm.expectEmit(true, true, true, true);
                home.hack_expectDispatchEvent(
                    governanceRouter.domains(i),
                    governanceRouter.routers(governanceRouter.domains(i)),
                    GovernanceMessage.formatTransferGovernor(
                        newDomain,
                        newGovernor.addressToBytes32()
                    ),
                    address(governanceRouter)
                );
            }
        }
        governanceRouter.transferGovernor(newDomain, newGovernor);
        assertEq(governanceRouter.governor(), address(0));
        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    }

    function test_transferGovernorLocalGovernor() public {
        uint32 newDomain = homeDomain;
        address newGovernor = vm.addr(9998888999);
        vm.expectEmit(true, true, true, true);
        emit TransferGovernor(
            homeDomain,
            newDomain,
            address(this),
            newGovernor
        );
        governanceRouter.transferGovernor(newDomain, newGovernor);
        assertEq(governanceRouter.governor(), newGovernor);
        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    }

    function test_transferGovernorLocalGovernorFuzzed(address newGovernor)
        public
    {
        uint32 newDomain = homeDomain;
        if (newGovernor == address(0)) {
            governanceRouter.transferGovernor(newDomain, newGovernor);
            vm.expectRevert("cannot renounce governor");
            return;
        }
        vm.expectEmit(true, true, true, true);
        emit TransferGovernor(
            homeDomain,
            newDomain,
            address(this),
            newGovernor
        );
        governanceRouter.transferGovernor(newDomain, newGovernor);
        assertEq(governanceRouter.governor(), newGovernor);
        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    }

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
        enterRecovery();
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

    function test_setRouterGlobalNewDomainr() public {
        uint32 domain = 123;
        bytes32 newRouter = "router";
        bytes32 previousRouter = governanceRouter.routers(domain);
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](1);
        remoteCalls[0].data = abi.encodeWithSignature(
            "setRouterLocal(uint32,bytes32)",
            domain,
            newRouter
        );
        uint256 length = governanceRouter.hack_domainsLength();
        for (uint256 i; i < length; i++) {
            uint32 dest = governanceRouter.domains(i);
            assert(dest != 0);
            bytes32 recipient = governanceRouter.routers(dest);
            remoteCalls[0].to = recipient;
            bytes memory message = GovernanceMessage.formatBatch(remoteCalls);
            vm.expectEmit(true, true, true, true);
            home.hack_expectDispatchEvent(
                dest,
                recipient,
                message,
                address(governanceRouter)
            );
        }
        vm.expectEmit(true, false, false, true);
        emit SetRouter(domain, previousRouter, newRouter);
        governanceRouter.setRouterGlobal(domain, newRouter);
    }

    function test_setRouterGlobalNewDomainFuzzed(
        uint32 domain,
        bytes32 newRouter
    ) public {
        vm.assume(domain != homeDomain && domain != 0);
        bytes32 previousRouter = governanceRouter.routers(domain);
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](1);
        remoteCalls[0].data = abi.encodeWithSignature(
            "setRouterLocal(uint32,bytes32)",
            domain,
            newRouter
        );
        uint256 length = governanceRouter.hack_domainsLength();
        for (uint256 i; i < length; i++) {
            uint32 dest = governanceRouter.domains(i);
            assert(dest != 0);
            bytes32 recipient = governanceRouter.routers(dest);
            remoteCalls[0].to = recipient;
            bytes memory message = GovernanceMessage.formatBatch(remoteCalls);
            vm.expectEmit(true, true, true, true);
            home.hack_expectDispatchEvent(
                dest,
                recipient,
                message,
                address(governanceRouter)
            );
        }
        vm.expectEmit(true, false, false, true);
        emit SetRouter(domain, previousRouter, newRouter);
        governanceRouter.setRouterGlobal(domain, newRouter);
    }

    function test_setRouterGlobaExistinglDomainHome() public {
        uint32 domain = homeDomain;
        bytes32 newRouter = "new router";
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](1);
        remoteCalls[0].data = abi.encodeWithSignature(
            "setRouterLocal(uint32,bytes32)",
            domain,
            newRouter
        );
        vm.expectRevert("can't set local router");
        governanceRouter.setRouterGlobal(domain, newRouter);
    }

    function test_setRouterGlobaExistinglDomainRemote() public {
        uint32 domain = remoteDomain;
        bytes32 newRouter = "new router";
        bytes32 previousRouter = governanceRouter.routers(domain);
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](1);
        remoteCalls[0].data = abi.encodeWithSignature(
            "setRouterLocal(uint32,bytes32)",
            domain,
            newRouter
        );
        uint256 length = governanceRouter.hack_domainsLength();
        for (uint256 i; i < length; i++) {
            uint32 dest = governanceRouter.domains(i);
            assert(dest != 0);
            bytes32 recipient = governanceRouter.routers(dest);
            remoteCalls[0].to = recipient;
            bytes memory message = GovernanceMessage.formatBatch(remoteCalls);
            vm.expectEmit(true, true, true, true);
            home.hack_expectDispatchEvent(
                dest,
                recipient,
                message,
                address(governanceRouter)
            );
        }
        vm.expectEmit(true, false, false, true);
        emit SetRouter(domain, previousRouter, newRouter);
        governanceRouter.setRouterGlobal(domain, newRouter);
    }

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
