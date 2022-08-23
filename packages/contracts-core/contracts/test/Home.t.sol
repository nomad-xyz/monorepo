// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {HomeHarness} from "./harnesses/HomeHarness.sol";
import {NomadBase} from "../NomadBase.sol";
import {NomadTestWithUpdaterManager} from "./utils/NomadTest.sol";
import {IUpdaterManager} from "../interfaces/IUpdaterManager.sol";
import {Message} from "../libs/Message.sol";

contract HomeTest is NomadTestWithUpdaterManager {
    HomeHarness home;

    function setUp() public override {
        super.setUp();
        home = new HomeHarness(homeDomain);
        home.initialize(IUpdaterManager(address(updaterManager)));
        updaterManager.setHome(address(home));
    }

    event Dispatch(
        bytes32 indexed messageHash,
        uint256 indexed leafIndex,
        uint64 indexed destinationAndNonce,
        bytes32 committedRoot,
        bytes message
    );

    function dispatchTestMessage() public returns (bytes memory, uint256) {
        bytes32 recipient = bytes32(uint256(uint160(vm.addr(1505))));
        address sender = vm.addr(1555);
        bytes memory messageBody = bytes("hey buddy");
        uint32 nonce = home.nonces(remoteDomain);
        bytes memory message = Message.formatMessage(
            homeDomain,
            bytes32(uint256(uint160(sender))),
            nonce,
            remoteDomain,
            recipient,
            messageBody
        );
        bytes32 messageHash = keccak256(message);
        vm.expectEmit(true, true, true, true);
        // first message that is sent on this home
        uint256 leafIndex = 0;
        emit Dispatch(
            messageHash,
            leafIndex,
            (uint64(remoteDomain) << 32) | nonce,
            home.committedRoot(),
            message
        );
        vm.prank(sender);
        home.dispatch(remoteDomain, recipient, messageBody);
        return (message, leafIndex);
    }

    event NewUpdater(address oldUpdater, address newUpdater);

    function test_onlyUpdaterManagerSetUpdater() public {
        vm.prank(address(updaterManager));
        address newUpdater = vm.addr(420);
        address oldUpdater = updater;
        vm.expectEmit(false, false, false, true);
        emit NewUpdater(oldUpdater, newUpdater);
        home.setUpdater(newUpdater);
    }

    function test_nonUpdaterManagerCannotSetUpdater() public {
        vm.prank(vm.addr(40123));
        vm.expectRevert("!updaterManager");
        home.setUpdater(vm.addr(420));
    }

    function test_committedRoot() public {
        bytes32 emptyRoot;
        assertEq(abi.encode(home.committedRoot()), abi.encode(emptyRoot));
    }

    function test_dispatchSuccess() public {
        (bytes memory message, uint256 leafIndex) = dispatchTestMessage();
        uint256 nonce = home.nonces(remoteDomain);
        (bytes32 root, , uint256 index, ) = merkleTest.getProof(message);
        assertEq(root, home.root());
        assert(home.queueContains(root));
        assertEq(index, leafIndex);
        assert(root != home.committedRoot());
        assertEq(uint256(home.nonces(remoteDomain)), nonce);
    }

    function test_dispatchRejectBigMessage() public {
        bytes32 recipient = bytes32(uint256(uint160(vm.addr(1505))));
        address sender = vm.addr(1555);
        bytes memory messageBody = new bytes(2 * 2**10 + 1);
        vm.prank(sender);
        vm.expectRevert("msg too long");
        home.dispatch(remoteDomain, recipient, messageBody);
    }

    function test_dispatchRejectFailedState() public {
        test_improperUpdate();
        vm.expectRevert("failed state");
        bytes memory messageBody = hex"3432bb02";
        bytes32 recipient = bytes32(uint256(uint160(vm.addr(1505))));
        home.dispatch(remoteDomain, recipient, messageBody);
    }

    event Update(
        uint32 indexed homeDomain,
        bytes32 indexed oldRoot,
        bytes32 indexed newRoot,
        bytes signature
    );

    function test_updateSuccess() public {
        (bytes memory message, ) = dispatchTestMessage();
        bytes32 newRoot = home.root();
        bytes32 oldRoot = home.committedRoot();
        bytes memory sig = signHomeUpdate(updaterPK, oldRoot, newRoot);
        vm.expectEmit(true, true, true, true);
        emit Update(homeDomain, oldRoot, newRoot, sig);
        home.update(oldRoot, newRoot, sig);
        assertEq(newRoot, home.committedRoot());
        assertEq(home.queueLength(), 0);
        assert(!home.queueContains(newRoot));
    }

    function test_updateRejectFailedState() public {
        test_improperUpdate();
        bytes32 newRoot = home.root();
        bytes32 oldRoot = home.committedRoot();
        bytes memory sig = signHomeUpdate(updaterPK, oldRoot, newRoot);
        vm.expectRevert("failed state");
        home.update(oldRoot, newRoot, sig);
    }

    function test_suggestUpdate() public {
        (bytes memory message, ) = dispatchTestMessage();
        (bytes32 root, , , ) = merkleTest.getProof(message);
        (bytes32 oldRoot, bytes32 newRoot) = home.suggestUpdate();
        assertEq(home.committedRoot(), oldRoot);
        assertEq(root, newRoot);
    }

    event ImproperUpdate(bytes32 oldRoot, bytes32 newRoot, bytes signature);

    function test_improperUpdate() public {
        bytes32 newRoot = "new root";
        bytes32 oldRoot = home.committedRoot();
        bytes memory sig = signHomeUpdate(updaterPK, oldRoot, newRoot);
        vm.expectEmit(false, false, false, true);
        emit ImproperUpdate(oldRoot, newRoot, sig);
        home.improperUpdate(oldRoot, newRoot, sig);
        assertEq(uint256(home.state()), uint256(NomadBase.States.Failed));
    }

    function test_homeDomainHash() public {
        assertEq(
            home.homeDomainHash(),
            keccak256(abi.encodePacked(homeDomain, "NOMAD"))
        );
    }

    function test_destinationAndNonce() public {
        uint32 destination = 10;
        uint32 nonce = 14;
        assertEq(
            uint256((uint64(destination) << 32) | nonce),
            uint256(home.exposed_destinationAndNonce(destination, nonce))
        );
    }
}
