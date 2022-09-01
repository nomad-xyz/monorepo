// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/console2.sol";
import "forge-std/Test.sol";
import "../DABridgeMessage.sol";
import "../DABridgeRouter.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

contract DABridgeRouterTest is Test {
    DABridgeRouter router;

    event Receive(
        uint64 indexed originAndNonce,
        uint64 indexed blockNumber,
        bytes32 root
    );

    uint32 domain = uint32(1);
    bytes32 remoteRouter = bytes32(uint256(1));

    uint64 _blockNumber = type(uint64).max;
    bytes32 _dataRoot = keccak256("dataRoot");

    function setUp() public {
        // mock replica
        XAppConnectionManager m = new XAppConnectionManager();
        m.ownerEnrollReplica(address(this), uint32(1));
        router = new DABridgeRouter();
        router.initialize(address(m));
        // mock remote router
        router.enrollRemoteRouter(domain, remoteRouter);
    }

    function test_failsInvalidMessageType() public {
        bytes memory message = new bytes(100);
        vm.expectRevert("!valid message");
        router.handle(domain, uint32(0), remoteRouter, message);
    }

    function test_failsInvalidMessageLength() public {
        bytes memory message = abi.encodePacked(uint8(1), uint256(1));
        vm.expectRevert("!valid message");
        router.handle(domain, uint32(0), remoteRouter, message);
    }

    function test_handleSuccess() public {
        bytes memory message = DABridgeMessage.formatDataRoot(
            _blockNumber,
            _dataRoot
        );
        uint64 originAndNonce = (uint64(domain) << 32) | 0;
        vm.expectEmit(true, true, false, true);
        emit Receive(originAndNonce, _blockNumber, _dataRoot);
        router.handle(domain, uint32(0), remoteRouter, message);
        assertEq(uint256(router.roots(_blockNumber)), uint256(_dataRoot));
    }
}
