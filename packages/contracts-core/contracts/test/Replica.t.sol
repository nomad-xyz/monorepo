// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {ReplicaHarness} from "./harnesses/ReplicaHarness.sol";
import {Replica} from "../Replica.sol";
import {ReplicaHandlers} from "./utils/NomadTest.sol";
import {Message} from "../libs/Message.sol";

import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

contract ReplicaTest is ReplicaHandlers {
    // Read about memview: https://github.com/summa-tx/memview-sol
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using Message for bytes29;

    ReplicaHarness replica;

    uint256 optimisticTimeout;
    bytes32 committedRoot;

    bytes32 exampleRoot;
    bytes32 exampleLeaf;
    uint256 exampleLeafIndex;
    bytes32[32] exampleProof;

    function setUp() public virtual override {
        super.setUp();
        committedRoot = "commited root";

        replica = new ReplicaHarness(homeDomain);

        setUpExampleProof();
        initializeReplica();
    }

    function setUpExampleProof() public {
        exampleRoot = hex"18f2f1646fee335a1eaf5191a8ce58ea772080057d0fda687df59c45e47e6f68";
        exampleLeaf = hex"f0fe7c99ef23ace1835385e83dd61c9ecb6192d6514fcc13356ef912788eaa8a";
        exampleLeafIndex = 0;
        exampleProof[
            0
        ] = hex"65ad6b7c39c687dad3edc05bec09300b742363f5c1f42db586bdce40c9fc5eef";
        exampleProof[
            1
        ] = hex"e9884debea0619a2ce25ba3bbe6a4438a42bc11b2308f62c65ed43be0b43d445";
        exampleProof[
            2
        ] = hex"b4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30";
        exampleProof[
            3
        ] = hex"21ddb9a356815c3fac1026b6dec5df3124afbadb485c9ba5a3e3398a04b7ba85";
        exampleProof[
            4
        ] = hex"e58769b32a1beaf1ea27375a44095a0d1fb664ce2dd358e7fcbfb78c26a19344";
        exampleProof[
            5
        ] = hex"0eb01ebfc9ed27500cd4dfc979272d1f0913cc9f66540d7e8005811109e1cf2d";
        exampleProof[
            6
        ] = hex"887c22bd8750d34016ac3c66b5ff102dacdd73f6b014e710b51e8022af9a1968";
        exampleProof[
            7
        ] = hex"ffd70157e48063fc33c97a050f7f640233bf646cc98d9524c6b92bcf3ab56f83";
        exampleProof[
            8
        ] = hex"9867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756af";
        exampleProof[
            9
        ] = hex"cefad4e508c098b9a7e1d8feb19955fb02ba9675585078710969d3440f5054e0";
        exampleProof[
            10
        ] = hex"f9dc3e7fe016e050eff260334f18a5d4fe391d82092319f5964f2e2eb7c1c3a5";
        exampleProof[
            11
        ] = hex"f8b13a49e282f609c317a833fb8d976d11517c571d1221a265d25af778ecf892";
        exampleProof[
            12
        ] = hex"3490c6ceeb450aecdc82e28293031d10c7d73bf85e57bf041a97360aa2c5d99c";
        exampleProof[
            13
        ] = hex"c1df82d9c4b87413eae2ef048f94b4d3554cea73d92b0f7af96e0271c691e2bb";
        exampleProof[
            14
        ] = hex"5c67add7c6caf302256adedf7ab114da0acfe870d449a3a489f781d659e8becc";
        exampleProof[
            15
        ] = hex"da7bce9f4e8618b6bd2f4132ce798cdc7a60e7e1460a7299e3c6342a579626d2";
        exampleProof[
            16
        ] = hex"2733e50f526ec2fa19a22b31e8ed50f23cd1fdf94c9154ed3a7609a2f1ff981f";
        exampleProof[
            17
        ] = hex"e1d3b5c807b281e4683cc6d6315cf95b9ade8641defcb32372f1c126e398ef7a";
        exampleProof[
            18
        ] = hex"5a2dce0a8a7f68bb74560f8f71837c2c2ebbcbf7fffb42ae1896f13f7c7479a0";
        exampleProof[
            19
        ] = hex"b46a28b6f55540f89444f63de0378e3d121be09e06cc9ded1c20e65876d36aa0";
        exampleProof[
            20
        ] = hex"c65e9645644786b620e2dd2ad648ddfcbf4a7e5b1a3a4ecfe7f64667a3f0b7e2";
        exampleProof[
            21
        ] = hex"f4418588ed35a2458cffeb39b93d26f18d2ab13bdce6aee58e7b99359ec2dfd9";
        exampleProof[
            22
        ] = hex"5a9c16dc00d6ef18b7933a6f8dc65ccb55667138776f7dea101070dc8796e377";
        exampleProof[
            23
        ] = hex"4df84f40ae0c8229d0d6069e5c8f39a7c299677a09d367fc7b05e3bc380ee652";
        exampleProof[
            24
        ] = hex"cdc72595f74c7b1043d0e1ffbab734648c838dfb0527d971b602bc216c9619ef";
        exampleProof[
            25
        ] = hex"0abf5ac974a1ed57f4050aa510dd9c74f508277b39d7973bb2dfccc5eeb0618d";
        exampleProof[
            26
        ] = hex"b8cd74046ff337f0a7bf2c8e03e10f642c1886798d71806ab1e888d9e5ee87d0";
        exampleProof[
            27
        ] = hex"838c5655cb21c6cb83313b5a631175dff4963772cce9108188b34ac87c81c41e";
        exampleProof[
            28
        ] = hex"662ee4dd2dd7b2bc707961b1e646c4047669dcb6584f0d8d770daf5d7e7deb2e";
        exampleProof[
            29
        ] = hex"388ab20e2573d171a88108e79d820e98f26c0b84aa8b2f4aa4968dbb818ea322";
        exampleProof[
            30
        ] = hex"93237c50ba75ee485f4c22adf2f741400bdf8d6a9cc7df7ecae576221665d735";
        exampleProof[
            31
        ] = hex"8448818bb4ae4562849e949e17ac16e0be16688e156b5cf15e098c627c0056a9";
    }

    function initializeReplica() public {
        optimisticTimeout = 10;

        replica.initialize(
            remoteDomain,
            updaterAddr,
            committedRoot,
            optimisticTimeout
        );
        assertEq(uint256(replica.remoteDomain()), uint256(remoteDomain));
        assertEq(replica.committedRoot(), committedRoot);
        assertEq(replica.optimisticSeconds(), optimisticTimeout);
        assertEq(replica.confirmAt(committedRoot), 1);
    }

    function test_acceptReplicaUpdate() public {
        bytes32 oldRoot = committedRoot;
        bytes32 newRoot = "newRoot";
        bytes memory sig = signRemoteUpdate(updaterPK, oldRoot, newRoot);
        vm.expectEmit(true, true, true, true);
        emit Update(remoteDomain, oldRoot, newRoot, sig);
        replica.update(oldRoot, newRoot, sig);

        assertEq(
            replica.confirmAt(newRoot),
            block.timestamp + optimisticTimeout
        );
        assertEq(replica.committedRoot(), newRoot);
    }

    function test_rejectReplicaNonCurrentUpdate() public {
        bytes32 oldRoot = "non commited root";
        bytes32 newRoot = "newRoot";
        bytes memory sig = signRemoteUpdate(updaterPK, oldRoot, newRoot);
        vm.expectRevert("not current update");
        replica.update(oldRoot, newRoot, sig);
    }

    function test_rejectReplicaUpdateInvalidSig() public {
        bytes32 oldRoot = committedRoot;
        bytes32 newRoot = "newRoot";
        bytes memory sig = signRemoteUpdate(fakeUpdaterPK, oldRoot, newRoot);
        vm.expectRevert("!updater sig");
        replica.update(oldRoot, newRoot, sig);
    }

    // Pre-computed values come from the nomad-xyz/rust test fixtures
    // https://github.com/nomad-xyz/rust/blob/main/fixtures/merkle.json
    function test_acceptLeafCorrectProof() public virtual {
        replica.setCommittedRoot(exampleRoot);
        assertTrue(replica.prove(exampleLeaf, exampleProof, exampleLeafIndex));
    }

    function test_rejectLeafWrongProof() public {
        replica.setCommittedRoot(exampleRoot);
        // We change a small part of the proof to invalidate it
        exampleProof[31] = "lol wrong proof m8";
        assertFalse(replica.prove(exampleLeaf, exampleProof, exampleLeafIndex));
    }

    event Process(
        bytes32 indexed messageHash,
        bool indexed success,
        bytes indexed returnData
    );

    function test_proveAndProcess() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(uint256(uint160(address(goodXappSimple))));
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
        (bytes32 root, , uint256 index, bytes32[32] memory proof) = merkleTest
            .getProof(message);
        replica.setCommittedRoot(root);
        vm.expectEmit(true, true, true, true);
        bytes memory returnData = hex"";
        emit Process(message.ref(0).keccak(), true, returnData);
        replica.proveAndProcess(message, proof, index);
    }

    function test_processProvenMessage() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(uint256(uint160(address(goodXappSimple))));
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
        (
            bytes32 root,
            bytes32 leaf,
            uint256 index,
            bytes32[32] memory proof
        ) = merkleTest.getProof(message);
        replica.setCommittedRoot(root);
        assertTrue(replica.prove(leaf, proof, index));
        assertTrue(replica.process(message));
    }

    function test_updateProveAndProcessMessage() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(uint256(uint160(address(goodXappSimple))));
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
        (
            bytes32 newRoot,
            bytes32 leaf,
            uint256 index,
            bytes32[32] memory proof
        ) = merkleTest.getProof(message);
        bytes32 oldRoot = committedRoot;
        bytes memory sig = signRemoteUpdate(updaterPK, oldRoot, newRoot);
        replica.update(oldRoot, newRoot, sig);
        vm.warp(block.timestamp + replica.optimisticSeconds());
        assertTrue(replica.prove(leaf, proof, index));
        assertTrue(replica.process(message));
    }

    /// @notice It should revert because process will call handle() in an empty address
    function test_notProcessLegacyProvenMessageEmptyAddress() public {
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
        replica.setMessageStatus(message, replica.LEGACY_STATUS_PROVEN());
        vm.expectRevert();
        replica.process(message);
    }

    /// @notice It should not revert because process will call handle() and handle will simply return 0
    function test_processLegacyProvenMessageReturnZeroHandler() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(
            uint256(uint160(address(badXappAssemblyReturnZero)))
        );
        uint32 nonce = 0;
        bytes memory messageBody = hex"";
        bytes memory message = Message.formatMessage(
            remoteDomain,
            sender,
            nonce,
            homeDomain,
            receiver,
            messageBody
        );
        replica.setMessageStatus(message, replica.LEGACY_STATUS_PROVEN());
        vm.expectEmit(true, true, true, true);
        emit Process(message.ref(0).keccak(), true, "");
        assertTrue(replica.process(message));
    }

    /// @notice It should revert because it calls a handle() function that has a require() that is not satisfied
    function test_notProcessLegacyProvenMessageRevertingHandlers1() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(
            uint256(uint160(address(badXappRevertRequire)))
        );
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
        replica.setMessageStatus(message, replica.LEGACY_STATUS_PROVEN());
        vm.expectRevert();
        replica.process(message);
    }

    /// @notice It revert because it calls a handle() function that has a require() that isn't satisfied. That require
    //also returns a revert reason string
    function test_notProcessLegacyProvenMessageRevertingHandlers2() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(
            uint256(uint160(address(badXappRevertRequireString)))
        );
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
        replica.setMessageStatus(message, replica.LEGACY_STATUS_PROVEN());
        vm.expectRevert("no can do");
        replica.process(message);
    }

    /// @notice It should revert because it calls a handle() function that has a revert() call in the assembly{} block
    function test_notProcessLegacyProvenMessageRevertingHandlers3() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(
            uint256(uint160(address(badXappRevertData)))
        );
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
        replica.setMessageStatus(message, replica.LEGACY_STATUS_PROVEN());
        vm.expectRevert(
            hex"0000000000000000000000000000000000000000000000000000000000abcdef"
        );
        replica.process(message);
    }

    /// @notice It should revert because it calls a handle() function that has a revert() call in the assembly{} block
    function test_notProcessLegacyProvenMessageRevertingHandlers4() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(
            uint256(uint160(address(badXappAssemblyRevert)))
        );
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
        replica.setMessageStatus(message, replica.LEGACY_STATUS_PROVEN());
        vm.expectRevert();
        replica.process(message);
    }

    /// @notice It should revert because the message's destination is not this Replica's domain
    function test_notProcessLegacyWrongDestination() public {
        replica.setCommittedRoot(exampleRoot);
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(uint256(uint160(vm.addr(431))));
        uint32 nonce = 0;
        bytes memory messageBody = "0x";
        bytes memory message = Message.formatMessage(
            homeDomain,
            sender,
            nonce,
            remoteDomain,
            receiver,
            messageBody
        );
        replica.setMessageStatus(message, replica.LEGACY_STATUS_PROVEN());
        vm.expectRevert("!destination");
        replica.process(message);
    }

    /// @notice It should revert because the message is not proven, i.e is not included in the committed Root
    function test_notProcessUnprovenMessage() public {
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

    event SetOptimisticTimeout(uint256 optimisticSeconds);

    function test_setOptimisticTimeoutOnlyOwner() public {
        vm.expectEmit(false, false, false, true);
        emit SetOptimisticTimeout(30000);
        vm.prank(replica.owner());
        replica.setOptimisticTimeout(30000);
        vm.prank(vm.addr(1453));
        vm.expectRevert("Ownable: caller is not the owner");
        replica.setOptimisticTimeout(10);
    }

    function test_setUpdaterOnlyOwner() public {
        vm.expectEmit(false, false, false, true);
        emit NewUpdater(updaterAddr, vm.addr(10));
        vm.prank(replica.owner());
        replica.setUpdater(vm.addr(10));
        vm.prank(vm.addr(1453));
        vm.expectRevert("Ownable: caller is not the owner");
        replica.setUpdater(vm.addr(10));
    }

    event SetConfirmation(
        bytes32 indexed root,
        uint256 previousConfirmAt,
        uint256 newConfirmAt
    );

    function test_setConfirmationOnlyOwnerNotZeroRoot() public {
        bytes32 newRoot = "new root";
        uint256 newConfirmAt = 100;
        uint256 previousConfirmAt = 0;
        vm.expectEmit(true, false, false, true);
        emit SetConfirmation(newRoot, previousConfirmAt, newConfirmAt);
        vm.prank(replica.owner());
        replica.setConfirmation(newRoot, newConfirmAt);
        assertEq(replica.confirmAt(newRoot), newConfirmAt);
        vm.prank(vm.addr(1453));
        vm.expectRevert("Ownable: caller is not the owner");
        replica.setConfirmation(newRoot, newConfirmAt);
    }

    function test_setConfirmationZeroRootOnlyRemove() public {
        bytes32 newRoot = bytes32(0);
        uint256 newConfirmAt = 0;
        uint256 previousConfirmAt = replica.confirmAt(newRoot);
        vm.expectEmit(true, false, false, true);
        emit SetConfirmation(newRoot, previousConfirmAt, newConfirmAt);
        vm.prank(replica.owner());
        replica.setConfirmation(newRoot, newConfirmAt);
        assertEq(replica.confirmAt(newRoot), newConfirmAt);
        vm.prank(replica.owner());
        newConfirmAt = 100;
        vm.expectRevert("can't set zero root");
        replica.setConfirmation(newRoot, newConfirmAt);
    }

    function test_acceptableRootSuccess() public {
        assertTrue(replica.acceptableRoot(committedRoot));
    }

    function test_acceptableRootLegacySuccess() public {
        assertTrue(replica.acceptableRoot(replica.LEGACY_STATUS_PROVEN()));
    }

    function test_acceptableRootLegacyRejectStatus() public {
        assertFalse(replica.acceptableRoot(replica.LEGACY_STATUS_PROCESSED()));
        assertFalse(replica.acceptableRoot(replica.LEGACY_STATUS_NONE()));
    }

    function test_acceptableRootRejectNotCommited() public {
        bytes32 notSubmittedRoot = "no";
        assertFalse(replica.acceptableRoot(notSubmittedRoot));
    }

    function test_acceptableRootRejectNotTimedOut() public {
        bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
        bytes32 receiver = bytes32(uint256(uint160(address(goodXappSimple))));
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
        (bytes32 newRoot, , , ) = merkleTest.getProof(message);
        bytes32 oldRoot = committedRoot;
        bytes memory sig = signRemoteUpdate(updaterPK, oldRoot, newRoot);
        replica.update(oldRoot, newRoot, sig);
        assertFalse(replica.acceptableRoot(newRoot));
    }
}
