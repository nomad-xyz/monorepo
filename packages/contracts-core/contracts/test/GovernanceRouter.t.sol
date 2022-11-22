// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// test imports
import {GovernanceRouterHarness} from "./harnesses/GovernanceRouterHarness.sol";
import {GovernanceRouter} from "../governance/GovernanceRouter.sol";
import {Home} from "../Home.sol";
import {GoodXappSimple} from "./utils/GoodXapps.sol";
import "forge-std/Test.sol";

// external imports
import {GovernanceMessage} from "../governance/GovernanceMessage.sol";
import {MockXAppConnectionManager} from "./utils/MockXAppConnectionManager.sol";
import {MockHome} from "@nomad-xyz/contracts-bridge/contracts/test/utils/MockHome.sol";
import {NomadTest} from "./utils/NomadTest.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {TypeCasts} from "../libs/TypeCasts.sol";

// TODO add Recovery and NotRecovery to names
// TODO add governor and recovery manager to names
// TODO change to expectCall for other tests like BridgeRouter
// TODO: transfer governor tests depend on the current governor domain & will fail if homeDomain is not governorDomain
// TODO: testSetRouterGlobal it doesn't work in recovery
// TODO functionName_additionalSetupInformation_recoveryOrNot_expectedOutcome
// state:
//  - is governor domain; is not governor domain
//  - is in recovery; is not in recovery
//  - ??

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

    uint256 timelock = 24 * 60 * 60;
    address recoveryManager;

    GovernanceMessage.Call[] calls;
    bytes32 callsBatchHash;

    bytes32 remoteGovernanceRouter;
    uint32 remoteGovernanceDomain; // TODO: survey places this is used
    address replica;

    event TransferGovernor(
        uint32 previousGovernorDomain,
        uint32 newGovernorDomain,
        address indexed previousGovernor,
        address indexed newGovernor
    );

    function setUp() public virtual override {
        // deploy fake xapp
        goodXapp = new GoodXappSimple();
        // Set remote vars
        remoteGovernanceDomain = remoteDomain;
        remoteGovernanceRouter = vm.addr(420809).addressToBytes32();
        replica = vm.addr(999);
        // setup home and xApp connection manager
        home = new MockHome(homeDomain);
        xAppConnectionManager = new MockXAppConnectionManager(
            address(home),
            replica
        );
        // setup governance router
        governanceRouter = new GovernanceRouterHarness(homeDomain, timelock);
        governanceRouter.initialize(
            address(xAppConnectionManager),
            recoveryManager
        );
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

    function test_handleOnlyReplicaNotInRecovery() public {
        // exit recovery
        if (governanceRouter.inRecovery()) exitRecovery();
        // if currently governor domain, transfer to remote governor
        // else the router will not accept incoming messages
        if (governanceRouter.governorDomain() == homeDomain) {
            vm.prank(governanceRouter.governor());
            governanceRouter.transferGovernor(remoteDomain, vm.addr(412));
        }
        // calling handle from non-replica reverts
        vm.expectRevert("!replica");
        vm.prank(vm.addr(789));
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            "mock"
        );
        // calling handle from replica passes the onlyReplica test
        // (it will still revert because rubbish message, but with
        // a diff error message because it passed the onlyReplica modifier)
        vm.expectRevert("!valid message type");
        vm.prank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            "mock"
        );
    }

    function test_handleOnlyReplicaRecovery() public {
        // if currently governor domain, transfer to remote governor
        // else the router will not accept incoming messages
        if (governanceRouter.governorDomain() == homeDomain) {
            if (governanceRouter.inRecovery()) exitRecovery();
            vm.prank(governanceRouter.governor());
            governanceRouter.transferGovernor(remoteDomain, vm.addr(412));
        }
        // enter recovery
        if (!governanceRouter.inRecovery()) enterRecovery();
        // calling handle from non-replica reverts
        vm.expectRevert("!replica");
        vm.prank(vm.addr(789));
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            "mock"
        );
        // calling handle from replica passes the onlyReplica test
        // (it will still revert because rubbish message, but with
        // a diff error message because it passed the onlyReplica modifier)
        vm.expectRevert("!valid message type");
        vm.prank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            "mock"
        );
    }

    function test_handleOnlyGovernorRouterNotInRecovery() public {
        // exit recovery
        if (governanceRouter.inRecovery()) exitRecovery();
        // if currently governor domain, transfer to remote governor
        // else the router will not accept incoming messages
        if (governanceRouter.governorDomain() == homeDomain) {
            vm.prank(governanceRouter.governor());
            governanceRouter.transferGovernor(remoteDomain, vm.addr(412));
        }
        // sender is wrong
        vm.expectRevert("!governorRouter");
        vm.prank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            TypeCasts.addressToBytes32(vm.addr(412)),
            "data"
        );
        // domain is wrong
        vm.expectRevert("!governorRouter");
        vm.prank(replica);
        governanceRouter.handle(
            (remoteDomain + 1),
            0,
            remoteGovernanceRouter,
            "data"
        );
        // domain and sender are wrong
        vm.expectRevert("!governorRouter");
        vm.prank(replica);
        governanceRouter.handle(
            (remoteDomain + 1),
            0,
            remoteGovernanceRouter,
            "data"
        );
        // with correct domain and sender, passes onlyGovernorRouter test
        // (it will still revert because rubbish message, but with
        // a diff error message because it passed the onlyReplica modifier)
        vm.expectRevert("!valid message type");
        vm.prank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            "data"
        );
    }

    function test_handleOnlyGovernorRouterRecovery() public {
        // if currently governor domain, transfer to remote governor
        // else the router will not accept incoming messages
        if (governanceRouter.governorDomain() == homeDomain) {
            if (governanceRouter.inRecovery()) exitRecovery();
            vm.prank(governanceRouter.governor());
            governanceRouter.transferGovernor(remoteDomain, vm.addr(412));
        }
        // enter recovery
        if (!governanceRouter.inRecovery()) enterRecovery();
        // sender is wrong
        vm.expectRevert("!governorRouter");
        vm.prank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            TypeCasts.addressToBytes32(vm.addr(412)),
            "data"
        );
        // domain is wrong
        vm.expectRevert("!governorRouter");
        vm.prank(replica);
        governanceRouter.handle(
            (remoteDomain + 1),
            0,
            remoteGovernanceRouter,
            "data"
        );
        // domain and sender are wrong
        vm.expectRevert("!governorRouter");
        vm.prank(replica);
        governanceRouter.handle(
            (remoteDomain + 1),
            0,
            remoteGovernanceRouter,
            "data"
        );
        // with correct domain and sender, passes onlyGovernorRouter test
        // (it will still revert because rubbish message, but with
        // a diff error message because it passed the onlyReplica modifier)
        vm.expectRevert("!valid message type");
        vm.prank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            "data"
        );
    }

    event BatchReceived(bytes32 indexed batchHash);

    function test_handleBatchCorrectForm() public {
        // if currently governor domain, transfer to remote governor
        // else the router will not accept incoming messages
        if (governanceRouter.governorDomain() == homeDomain) {
            if (governanceRouter.inRecovery()) exitRecovery();
            vm.prank(governanceRouter.governor());
            governanceRouter.transferGovernor(remoteDomain, vm.addr(412));
        }
        // Create test batch for tests
        address to = address(0xBEEF);
        bytes memory data = "";
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        bytes32 batchHash = GovernanceMessage.getBatchHash(calls);
        // handle should emit BatchReceived event
        bytes memory message = GovernanceMessage.formatBatch(calls);
        vm.expectEmit(true, false, false, false);
        emit BatchReceived(batchHash);
        vm.startPrank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            message
        );
        // batch is pending
        assertEq(
            uint256(governanceRouter.inboundCallBatches(batchHash)),
            uint256(GovernanceRouter.BatchStatus.Pending)
        );
        // same batch can't be delivered while still pending
        vm.expectRevert("BatchStatus is Pending");
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            GovernanceMessage.formatBatch(calls)
        );
    }

    function test_handleTransferGovernor_toLocalGovernor_notRecovery_success()
        public
    {
        // if currently governor domain, transfer to remote governor
        // else the router will not accept incoming messages
        if (governanceRouter.governorDomain() == homeDomain) {
            if (governanceRouter.inRecovery()) exitRecovery();
            vm.prank(governanceRouter.governor());
            governanceRouter.transferGovernor(remoteDomain, vm.addr(412));
        }
        // Create test transfer gov message
        address newGov = vm.addr(812);
        bytes memory handleMessage = GovernanceMessage.formatTransferGovernor(
            homeDomain,
            newGov.addressToBytes32()
        );
        // handle should emit transfer governor event
        vm.expectEmit(true, false, false, false);
        emit TransferGovernor(
            governanceRouter.governorDomain(),
            homeDomain,
            address(0),
            newGov
        );
        vm.prank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            handleMessage
        );
        // governor should be transferred in storage
        assertEq(
            uint256(governanceRouter.governorDomain()),
            uint256(homeDomain)
        );
        assertEq(governanceRouter.governor(), newGov);
    }

    function test_handleTransferGovernor_toRemoteGovernor_notRecovery_success()
        public
    {
        if (governanceRouter.inRecovery()) exitRecovery();
        // if currently governor domain, transfer to remote governor
        // else the router will not accept incoming messages
        if (governanceRouter.governorDomain() == homeDomain) {
            vm.prank(governanceRouter.governor());
            governanceRouter.transferGovernor(remoteDomain, vm.addr(412));
        }
        uint32 newGovDomain = remoteDomain + 69;
        // set router for remote domain so gov can be transferred to it
        vm.prank(governanceRouter.governor());
        governanceRouter.setRouterLocal(
            newGovDomain,
            TypeCasts.addressToBytes32(vm.addr(9999988888))
        );
        // Create test transfer gov message
        address newGov = vm.addr(812);
        bytes memory handleMessage = GovernanceMessage.formatTransferGovernor(
            newGovDomain,
            newGov.addressToBytes32()
        );
        // handle should emit transfer governor event
        vm.expectEmit(true, false, false, false);
        emit TransferGovernor(
            governanceRouter.governorDomain(),
            newGovDomain,
            address(0),
            address(0)
        );
        vm.prank(replica);
        governanceRouter.handle(
            remoteDomain,
            0,
            remoteGovernanceRouter,
            handleMessage
        );
        // governor should be transferred in storage
        assertEq(
            uint256(governanceRouter.governorDomain()),
            uint256(newGovDomain)
        );
        assertEq(governanceRouter.governor(), address(0));
    }

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
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        uint32[] memory domains = new uint32[](1);
        vm.prank(recoveryManager);
        vm.expectRevert("!remote calls in recovery mode");
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsOnlyLocal() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](0);
        uint32[] memory domains = new uint32[](0);
        bytes32 to = address(goodXapp).addressToBytes32();
        bytes memory data = abi.encodeWithSignature("setNumber(uint256)", 55);
        localCalls[0] = GovernanceMessage.Call(to, data);
        vm.prank(governanceRouter.governor());
        vm.expectCall(
            address(goodXapp),
            abi.encodeWithSelector(GoodXappSimple.setNumber.selector, 55)
        );
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        assertEq(goodXapp.number(), 55);
    }

    function test_executeGovernanceActionsRecoveryOnlyLocal() public {
        if (!governanceRouter.inRecovery()) enterRecovery();
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](0);
        uint32[] memory domains = new uint32[](0);
        bytes32 to = address(goodXapp).addressToBytes32();
        bytes memory data = abi.encodeWithSignature("setNumber(uint256)", 55);
        localCalls[0] = GovernanceMessage.Call(to, data);
        vm.prank(recoveryManager);
        vm.expectCall(
            address(goodXapp),
            abi.encodeWithSelector(GoodXappSimple.setNumber.selector, 55)
        );
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
        assertEq(goodXapp.number(), 55);
    }

    function test_executeGovernanceActionsOnlyRemote() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        // construct remote calls
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](0);
        uint32[] memory remoteDomains = new uint32[](1);
        remoteDomains[0] = remoteDomain;
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        remoteCalls[0] = new GovernanceMessage.Call[](1);
        bytes32 to = TypeCasts.addressToBytes32(vm.addr(645));
        bytes memory data = hex"BEEF";
        remoteCalls[0][0] = GovernanceMessage.Call(to, data);
        // expect that Home dispatch is called
        vm.expectCall(
            address(home),
            abi.encodeWithSelector(
                Home.dispatch.selector,
                remoteDomains[0],
                remoteGovernanceRouter,
                GovernanceMessage.formatBatch(remoteCalls[0])
            )
        );
        // execute actions
        vm.prank(governanceRouter.governor());
        governanceRouter.executeGovernanceActions(
            localCalls,
            remoteDomains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsLocalAndRemote() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        bytes32 to = address(goodXapp).addressToBytes32();
        bytes memory data = abi.encodeWithSignature("setNumber(uint256)", 55);
        localCalls[0] = GovernanceMessage.Call(to, data);
        uint32[] memory remoteDomains = new uint32[](1);
        remoteDomains[0] = remoteDomain;
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](1);
        remoteCalls[0] = new GovernanceMessage.Call[](1);
        bytes32 remoteTo = TypeCasts.addressToBytes32(vm.addr(907));
        bytes memory remoteData = hex"BEEF";
        remoteCalls[0][0] = GovernanceMessage.Call(remoteTo, remoteData);
        vm.expectCall(
            address(goodXapp),
            abi.encodeWithSelector(GoodXappSimple.setNumber.selector, 55)
        );
        vm.expectCall(
            address(home),
            abi.encodeWithSelector(
                Home.dispatch.selector,
                remoteDomains[0],
                remoteGovernanceRouter,
                GovernanceMessage.formatBatch(remoteCalls[0])
            )
        );
        vm.prank(governanceRouter.governor());
        governanceRouter.executeGovernanceActions(
            localCalls,
            remoteDomains,
            remoteCalls
        );
        assertEq(goodXapp.number(), 55);
    }

    function test_executeGovernanceActionsLocalAndRemoteFuzzed(
        bytes32[8] memory fuzzTo,
        bytes[8] memory fuzzData,
        uint32[8] memory fuzzDomains,
        bytes32[8] memory fuzzRouter
    ) public {
        // exit recovery, no remote calls in recovery
        if (governanceRouter.inRecovery()) exitRecovery();
        // construct empty parameter arrays
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](8);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](8);
        uint32[] memory domains = new uint32[](8);
        // loop through fuzzed values
        for (uint256 i; i < 8; i++) {
            // set domain
            if (fuzzDomains[i] == homeDomain) {
                fuzzDomains[i] = fuzzDomains[i] + 1;
            }
            domains[i] = fuzzDomains[i];
            // setup remote router IFF it does not already exist
            if (fuzzRouter[i] == bytes32(0)) {
                fuzzRouter[i] = "non empty address";
            }
            if (governanceRouter.routers(fuzzDomains[i]) == bytes32(0)) {
                vm.prank(governanceRouter.governor());
                governanceRouter.setRouterLocal(fuzzDomains[i], fuzzRouter[i]);
            }
            // add remote call
            remoteCalls[i] = new GovernanceMessage.Call[](i + 1);
            for (uint256 j; j < i + 1; j++) {
                remoteCalls[i][j] = GovernanceMessage.Call(
                    fuzzTo[i],
                    fuzzData[i]
                );
            }
            vm.expectCall(
                address(home),
                abi.encodeWithSelector(
                    Home.dispatch.selector,
                    fuzzDomains[i],
                    governanceRouter.routers(fuzzDomains[i]),
                    GovernanceMessage.formatBatch(remoteCalls[i])
                )
            );
            // add local call
            localCalls[i] = GovernanceMessage.Call(
                address(goodXapp).addressToBytes32(),
                abi.encodeWithSignature("setNumber(uint256)", i)
            );
            vm.expectCall(
                address(goodXapp),
                abi.encodeWithSelector(GoodXappSimple.setNumber.selector, i)
            );
        }
        vm.prank(governanceRouter.governor());
        governanceRouter.executeGovernanceActions(
            localCalls,
            domains,
            remoteCalls
        );
    }

    function test_callRemoteOnlyGovernor() public {
        if (governanceRouter.inRecovery()) exitRecovery();
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
        vm.expectRevert("! called by governor");
        vm.prank(vm.addr(123));
        governanceRouter.executeGovernanceActions(
            localCalls,
            remoteDomains,
            remoteCalls
        );
        vm.expectRevert("! called by governor");
        vm.prank(recoveryManager);
        governanceRouter.executeGovernanceActions(
            localCalls,
            remoteDomains,
            remoteCalls
        );
    }

    function test_executeGovernanceActionsNotGovernanceRouter() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        GovernanceMessage.Call[]
            memory localCalls = new GovernanceMessage.Call[](1);
        uint32[] memory remoteDomains = new uint32[](0);
        GovernanceMessage.Call[][]
            memory remoteCalls = new GovernanceMessage.Call[][](0);
        vm.expectRevert("!sender is an external address");
        vm.prank(address(governanceRouter));
        governanceRouter.executeGovernanceActions(
            localCalls,
            remoteDomains,
            remoteCalls
        );
    }

    function test_callRemoteOnlyGovernorFuzzed(address nonGovernor) public {
        vm.assume(
            nonGovernor != governanceRouter.governor() &&
                nonGovernor != address(governanceRouter)
        );
        if (governanceRouter.inRecovery()) exitRecovery();
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
        vm.expectRevert("! called by governor");
        vm.prank(nonGovernor);
        governanceRouter.executeGovernanceActions(
            localCalls,
            remoteDomains,
            remoteCalls
        );
    }

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

    function test_transferGovernorRemoteGovernor() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        uint32 newGovernorDomain = remoteDomain;
        address newGovernor = vm.addr(9998888999);
        for (uint256 i = 0; i < governanceRouter.hack_domainsLength(); i++) {
            uint32 _domain = governanceRouter.domains(i);
            if (_domain != uint32(0)) {
                vm.expectCall(
                    address(home),
                    abi.encodeWithSelector(
                        Home.dispatch.selector,
                        _domain,
                        governanceRouter.routers(_domain),
                        GovernanceMessage.formatTransferGovernor(
                            newGovernorDomain,
                            TypeCasts.addressToBytes32(newGovernor)
                        )
                    )
                );
            }
        }
        vm.expectEmit(true, true, true, true);
        emit TransferGovernor(
            governanceRouter.governorDomain(),
            newGovernorDomain,
            governanceRouter.governor(),
            address(0)
        );
        vm.prank(governanceRouter.governor());
        governanceRouter.transferGovernor(newGovernorDomain, newGovernor);
        assertEq(governanceRouter.governor(), address(0));
        assertEq(uint256(governanceRouter.governorDomain()), newGovernorDomain);
    }

    function test_transferGovernorRemoteGovernorMustHaveRouter() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.prank(governanceRouter.governor());
        uint32 newDomain = 123;
        address newGovernor = vm.addr(9998888999);
        vm.expectRevert("!router");
        governanceRouter.transferGovernor(newDomain, newGovernor);
    }

    function test_transferGovernorRemoteGovernorFuzzed(
        uint32 newDomain,
        address newGovernor,
        bytes32 router
    ) public {
        vm.assume(
            newDomain != 0 &&
                newDomain != homeDomain &&
                newDomain != remoteDomain &&
                router != bytes32(0)
        );
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.prank(governanceRouter.governor());
        governanceRouter.setRouterLocal(newDomain, router);
        if (newGovernor == address(0)) {
            vm.prank(governanceRouter.governor());
            vm.expectRevert("cannot renounce governor");
            governanceRouter.transferGovernor(newDomain, newGovernor);
            return;
        }
        for (uint256 i = 0; i < governanceRouter.hack_domainsLength(); i++) {
            uint32 _domain = governanceRouter.domains(i);
            if (_domain != uint32(0)) {
                vm.expectCall(
                    address(home),
                    abi.encodeWithSelector(
                        Home.dispatch.selector,
                        _domain,
                        governanceRouter.routers(_domain),
                        GovernanceMessage.formatTransferGovernor(
                            newDomain,
                            TypeCasts.addressToBytes32(newGovernor)
                        )
                    )
                );
            }
        }
        vm.expectEmit(true, true, true, true);
        emit TransferGovernor(
            governanceRouter.governorDomain(),
            newDomain,
            governanceRouter.governor(),
            address(0)
        );
        vm.prank(governanceRouter.governor());
        governanceRouter.transferGovernor(newDomain, newGovernor);
        assertEq(governanceRouter.governor(), address(0));
        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    }

    function test_transferGovernorLocalGovernor() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        uint32 newDomain = homeDomain;
        address newGovernor = vm.addr(9998888999);
        // todo: expectNoCall Home.Dispatch
        vm.expectEmit(true, true, true, true);
        emit TransferGovernor(
            homeDomain,
            newDomain,
            governanceRouter.governor(),
            newGovernor
        );
        vm.prank(governanceRouter.governor());
        governanceRouter.transferGovernor(newDomain, newGovernor);
        assertEq(governanceRouter.governor(), newGovernor);
        assertEq(uint256(governanceRouter.governorDomain()), newDomain);
    }

    function test_transferGovernorLocalGovernorCANNOTRENOUNCE() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        uint32 newDomain = homeDomain;
        address newGovernor = address(0);
        vm.prank(governanceRouter.governor());
        vm.expectRevert("cannot renounce governor");
        governanceRouter.transferGovernor(newDomain, newGovernor);
    }

    function test_transferGovernorLocalGovernorFuzzed(address newGovernor)
        public
    {
        if (governanceRouter.inRecovery()) exitRecovery();
        uint32 newDomain = homeDomain;
        if (newGovernor == address(0)) {
            vm.prank(governanceRouter.governor());
            vm.expectRevert("cannot renounce governor");
            governanceRouter.transferGovernor(newDomain, newGovernor);
            return;
        }
        // todo: expectNoCall Home.Dispatch
        vm.expectEmit(true, true, true, true);
        emit TransferGovernor(
            homeDomain,
            newDomain,
            governanceRouter.governor(),
            newGovernor
        );
        vm.prank(governanceRouter.governor());
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

    function test_setRouterGlobalNewDomain() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        uint32 newDomain = 123;
        bytes32 newRouter = "router";
        bytes32 previousRouter = governanceRouter.routers(newDomain);
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](1);
        remoteCalls[0].data = abi.encodeWithSignature(
            "setRouterLocal(uint32,bytes32)",
            newDomain,
            newRouter
        );
        for (uint256 i; i < governanceRouter.hack_domainsLength(); i++) {
            uint32 _remoteDomain = governanceRouter.domains(i);
            bytes32 _remoteRouter = governanceRouter.routers(_remoteDomain);
            remoteCalls[0].to = _remoteRouter;
            vm.expectCall(
                address(home),
                abi.encodeWithSelector(
                    Home.dispatch.selector,
                    _remoteDomain,
                    _remoteRouter,
                    GovernanceMessage.formatBatch(remoteCalls)
                )
            );
        }
        vm.expectEmit(true, false, false, true);
        emit SetRouter(newDomain, previousRouter, newRouter);
        vm.prank(governanceRouter.governor());
        governanceRouter.setRouterGlobal(newDomain, newRouter);
    }

    function test_setRouterGlobalNewDomainFuzzed(
        uint32 newDomain,
        bytes32 newRouter
    ) public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.assume(newDomain != homeDomain && newDomain != 0);
        bytes32 previousRouter = governanceRouter.routers(newDomain);
        GovernanceMessage.Call[]
            memory remoteCalls = new GovernanceMessage.Call[](1);
        remoteCalls[0].data = abi.encodeWithSignature(
            "setRouterLocal(uint32,bytes32)",
            newDomain,
            newRouter
        );
        for (uint256 i; i < governanceRouter.hack_domainsLength(); i++) {
            uint32 _remoteDomain = governanceRouter.domains(i);
            bytes32 _remoteRouter = governanceRouter.routers(_remoteDomain);
            remoteCalls[0].to = _remoteRouter;
            vm.expectCall(
                address(home),
                abi.encodeWithSelector(
                    Home.dispatch.selector,
                    _remoteDomain,
                    _remoteRouter,
                    GovernanceMessage.formatBatch(remoteCalls)
                )
            );
        }
        vm.expectEmit(true, false, false, true);
        emit SetRouter(newDomain, previousRouter, newRouter);
        vm.prank(governanceRouter.governor());
        governanceRouter.setRouterGlobal(newDomain, newRouter);
    }

    function test_setRouterGlobaExistinglDomainHome() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        vm.prank(governanceRouter.governor());
        bytes32 newRouter = "new router";
        vm.expectRevert("can't set local router");
        governanceRouter.setRouterGlobal(homeDomain, newRouter);
    }

    function test_setRouterGlobaExistinglDomainRemote() public {
        if (governanceRouter.inRecovery()) exitRecovery();
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
            vm.expectCall(
                address(home),
                abi.encodeWithSelector(
                    Home.dispatch.selector,
                    dest,
                    recipient,
                    message
                )
            );
        }
        vm.expectEmit(true, false, false, true);
        emit SetRouter(domain, previousRouter, newRouter);
        vm.prank(governanceRouter.governor());
        governanceRouter.setRouterGlobal(domain, newRouter);
    }

    function test_setXAppConnectionManagerOnlyGovernor() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        MockHome newHome = new MockHome(homeDomain);
        MockXAppConnectionManager newMngr = new MockXAppConnectionManager(
            address(newHome),
            replica
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
            address(newHome),
            replica
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

    function test_executeCallBatchSuccessTargetReverts() public {
        address to = address(goodXapp);
        bytes memory data = abi.encodeWithSignature("itReverts()");
        calls.push(GovernanceMessage.Call(to.addressToBytes32(), data));
        bytes memory message = GovernanceMessage.formatBatch(calls);
        bytes32 hash = GovernanceMessage.getBatchHash(calls);
        // at first, batch does not exist
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Unknown)
        );
        // after handling the message, batch is pending
        governanceRouter.exposed_handleBatch(message, 1);
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Pending)
        );
        // batch cannot be executed because it will revert
        vm.expectRevert("call failed");
        governanceRouter.executeCallBatch(calls);
        // since the call failed, the batch is still pending
        assertEq(
            uint256(governanceRouter.inboundCallBatches(hash)),
            uint256(GovernanceRouter.BatchStatus.Pending)
        );
    }

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

    function test_setRouterExistingDomain() public {
        uint32 newDomain = remoteDomain;
        bytes32 newRouter = "AFDDF";
        bytes32 previousRouter = governanceRouter.routers(newDomain);
        uint256 previousDomainsLength = governanceRouter.hack_domainsLength();
        vm.expectEmit(true, true, true, false);
        emit SetRouter(newDomain, previousRouter, newRouter);
        governanceRouter.exposed_setRouter(newDomain, newRouter);
        assertEq(governanceRouter.routers(newDomain), newRouter);
        // we shouldn't add a new domain, since we set the router of
        // an existing domain
        assertEq(governanceRouter.hack_domainsLength(), previousDomainsLength);
    }

    // TODO: telemetry into domains array in fork mode?
    function test_setRouterRemoveDomain() public {
        if (governanceRouter.inRecovery()) exitRecovery();
        uint32 newDomain = remoteDomain;
        bytes32 newRouter = bytes32(0);
        bytes32 previousRouter = governanceRouter.routers(newDomain);
        vm.expectEmit(true, true, true, false);
        emit SetRouter(newDomain, previousRouter, newRouter);
        vm.prank(governanceRouter.governor());
        governanceRouter.setRouterLocal(newDomain, newRouter);
        assertEq(governanceRouter.routers(newDomain), newRouter);
    }

    // TODO: telemetry into domains array in fork mode?
    function test_setRouterRemoveDomainRecovery() public {
        if (!governanceRouter.inRecovery()) enterRecovery();
        uint32 newDomain = remoteDomain;
        bytes32 newRouter = bytes32(0);
        bytes32 previousRouter = governanceRouter.routers(newDomain);
        vm.expectEmit(true, true, true, false);
        emit SetRouter(newDomain, previousRouter, newRouter);
        vm.prank(recoveryManager);
        governanceRouter.setRouterLocal(newDomain, newRouter);
        assertEq(governanceRouter.routers(newDomain), newRouter);
    }

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
