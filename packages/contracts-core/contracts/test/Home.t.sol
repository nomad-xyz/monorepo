// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Home} from "../Home.sol";
import {NomadTestWithUpdaterManager} from "./utils/NomadTest.sol";
import {IUpdaterManager} from "../interfaces/IUpdaterManager.sol";
import {Message} from "../libs/Message.sol";


contract HomeTest is NomadTestWithUpdaterManager {
    Home home;

    function setUp() public override {
        super.setUp();
        home = new Home(homeDomain);
        home.initialize(IUpdaterManager(address(updaterManager)));
        updaterManager.setHome(address(home));
    }

    function test_homeDomain() public {
        assertEq(
            keccak256(abi.encodePacked(homeDomain, "NOMAD")),
            home.homeDomainHash()
        );
    }

    function test_onlyUpdaterManagerSetUpdater() public {
        vm.prank(address(updaterManager));
        home.setUpdater(vm.addr(420));
    }

    function test_nonUpdaterManagerCannotSetUpdater() public {
        vm.prank(vm.addr(40123));
        vm.expectRevert("!updaterManager");
        home.setUpdater(vm.addr(420));
    }

    function test_committedRoot() public{
      bytes32 emptyRoot;
      assertEq(abi.encode(home.committedRoot()), abi.encode(emptyRoot));
    }

    event Dispatch(
        bytes32 indexed messageHash,
        uint256 indexed leafIndex,
        uint64 indexed destinationAndNonce,
        bytes32 committedRoot,
        bytes message
    );

    function test_dispatch() public {
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
        emit Dispatch(messageHash, 0,(uint64(remoteDomain) << 32) | nonce, home.committedRoot(), message);
        vm.prank(sender);
        home.dispatch(remoteDomain, recipient, messageBody);
        assert(home.queueContains(home.root()));
    }

    function test_dispatchRejectBigMessage() public {
        bytes32 recipient = bytes32(uint256(uint160(vm.addr(1505))));
        address sender = vm.addr(1555);
        bytes memory messageBody = new bytes(2 * 2**10 + 1);
        uint32 nonce = home.nonces(remoteDomain);
        bytes memory message = Message.formatMessage(
          homeDomain,
          bytes32(uint256(uint160(sender))),
          nonce,
          remoteDomain,
          recipient,
          messageBody
        );
        vm.prank(sender);
        vm.expectRevert("msg too long");
        home.dispatch(remoteDomain, recipient, messageBody);
    }

    event ImproperUpdate(bytes32 oldRoot, bytes32 newRoot, bytes signature);

    function test_improperUpdate() public {
        bytes32 newRoot = "new root";
        bytes32 oldRoot = home.committedRoot();
        bytes memory sig = signHomeUpdate(updaterPK, oldRoot, newRoot);
        vm.expectEmit(false, false, false, true);
        emit ImproperUpdate(oldRoot, newRoot, sig);
        home.improperUpdate(oldRoot, newRoot, sig);
    }

}
