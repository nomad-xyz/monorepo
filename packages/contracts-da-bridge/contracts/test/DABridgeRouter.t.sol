// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/console2.sol";
import "forge-std/Test.sol";
import "../DABridgeMessage.sol";
import "../DABridgeRouter.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

contract DABridgeRouterTest is Test {
    DABridgeRouter router;

    event DataRootReceived(
        uint64 indexed originAndNonce,
        uint32 indexed blockNumber,
        bytes32 dataRoot
    );

    uint32 domain = uint32(1);
    uint32 invalidDomain = uint32(2);
    bytes32 remoteRouter = bytes32(uint256(1));

    uint32 _blockNumber = type(uint32).max;
    bytes32 _dataRoot = keccak256("dataRoot");

    function setUp() public {
        // mock replica
        XAppConnectionManager m = new XAppConnectionManager();
        m.ownerEnrollReplica(address(this), uint32(1));
        router = new DABridgeRouter();
        router.initialize(address(m), domain);
        // mock remote router
        router.enrollRemoteRouter(domain, remoteRouter);
        router.enrollRemoteRouter(invalidDomain, remoteRouter);
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

    function test_failsInvalidDomain() public {
        DABridgeMessage.DataRootBatchItem[]
            memory _dataRoots = new DABridgeMessage.DataRootBatchItem[](1);

        _dataRoots[0] = DABridgeMessage.DataRootBatchItem({
            dataRoot: _dataRoot,
            blockNumber: _blockNumber
        });

        bytes memory message = DABridgeMessage.formatDataRootBatch(_dataRoots);
        vm.expectRevert("!valid domain");
        router.handle(invalidDomain, uint32(0), remoteRouter, message);
    }

    function test_handleSuccess() public {
        DABridgeMessage.DataRootBatchItem[]
            memory _dataRoots = new DABridgeMessage.DataRootBatchItem[](1);

        _dataRoots[0] = DABridgeMessage.DataRootBatchItem({
            dataRoot: _dataRoot,
            blockNumber: _blockNumber
        });

        bytes memory message = DABridgeMessage.formatDataRootBatch(_dataRoots);
        uint64 originAndNonce = (uint64(domain) << 32) | 0;
        vm.expectEmit(true, true, false, true);
        emit DataRootReceived(originAndNonce, _blockNumber, _dataRoot);
        router.handle(domain, uint32(0), remoteRouter, message);
        assertEq(uint256(router.roots(_blockNumber)), uint256(_dataRoot));
    }
}
