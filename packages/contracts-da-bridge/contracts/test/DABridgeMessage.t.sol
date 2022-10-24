// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

/*//////////////////////////////////////////////////////////////
                           CONTRACTS
//////////////////////////////////////////////////////////////*/

import {DABridgeMessage} from "../DABridgeMessage.sol";

/*//////////////////////////////////////////////////////////////
                            LIBRARIES
//////////////////////////////////////////////////////////////*/

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/libs/TypeCasts.sol";

contract DABridgeMessageTest is Test {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using DABridgeMessage for bytes29;

    uint256 private constant IDENTIFIER_LEN = 1;
    uint256 private constant COUNT_LEN = 2;
    uint256 private constant BLOCK_NUMBER_LEN = 4;
    uint256 private constant DATA_ROOT_LEN = 32;

    uint32 _blockNumber = type(uint32).max;
    bytes32 _dataRoot = keccak256("dataRoot");

    function setUp() public {}

    /// @notice Verify that the enum for the memview types remains unchaged
    function test_typeOrderUnchanged() public {
        assertEq(uint256(DABridgeMessage.Types.Invalid), 0);
        assertEq(uint256(DABridgeMessage.Types.DataRootBatch), 1);
    }

    /// @notice A DABridgeMessage must be IDENTIFIER_LEN + BLOCK_NUMBER_LEN + DATA_ROOT_LEN
    /// so that it can contain all the required information needed by the Bridge.
    function test_isValidMessageLength(uint16 count) public {
        vm.assume(count > 0);
        bytes memory identifierAndLength = abi.encodePacked(uint8(0), count);
        uint256 correctLength = count * (BLOCK_NUMBER_LEN + DATA_ROOT_LEN);
        bytes memory longMessage = abi.encodePacked(
            identifierAndLength,
            new bytes(correctLength + 1)
        );
        bytes memory correctMessage = abi.encodePacked(
            identifierAndLength,
            new bytes(correctLength)
        );
        bytes memory shortMessage = abi.encodePacked(
            identifierAndLength,
            new bytes(correctLength - 1)
        );
        bytes29 longView = longMessage.ref(0);
        bytes29 correctView = correctMessage.ref(0);
        bytes29 shortView = shortMessage.ref(0);
        assertFalse(shortView.isValidDataRootBatchLength());
        assertFalse(longView.isValidDataRootBatchLength());
        assertTrue(correctView.isValidDataRootBatchLength());
    }

    function test_messageTypeReturnsCorrectType() public {
        bytes memory emptyMessage = new bytes(100);
        bytes29 emptyView = emptyMessage.ref(0); // Type 0
        bytes29 viewUnderTest;
        viewUnderTest = emptyView.castTo(uint40(DABridgeMessage.Types.Invalid));
        assertEq(
            uint256(viewUnderTest.messageType()),
            uint256(DABridgeMessage.Types.Invalid)
        );
        viewUnderTest = emptyView.castTo(
            uint40(DABridgeMessage.Types.DataRootBatch)
        );
        assertEq(
            uint256(viewUnderTest.messageType()),
            uint256(DABridgeMessage.Types.DataRootBatch)
        );
    }

    function test_detectsCorrectType() public {
        bytes memory message = abi.encodePacked(
            uint8(DABridgeMessage.Types.DataRootBatch),
            uint32(1),
            _blockNumber,
            _dataRoot
        );
        bytes29 _view = message.ref(0);
        assertFalse(_view.isDataRootBatch());
        _view = _view.getTypedView();
        assertTrue(_view.isDataRootBatch());
    }

    function test_assertsExistingType() public {
        bytes memory message = abi.encodePacked(
            uint8(255),
            uint32(1),
            _blockNumber,
            _dataRoot
        );
        bytes29 _view = message.ref(0);
        vm.expectRevert(stdError.lowLevelError);
        _view.getTypedView();
    }

    function test_formatDataRootSucceeds() public {
        bytes29 manualDataRoot = abi
            .encodePacked(
                DABridgeMessage.Types.DataRootBatch,
                uint16(1),
                _blockNumber,
                _dataRoot
            )
            .ref(0);

        DABridgeMessage.DataRootBatchItem[]
            memory _dataRoots = new DABridgeMessage.DataRootBatchItem[](1);

        _dataRoots[0] = DABridgeMessage.DataRootBatchItem({
            dataRoot: _dataRoot,
            blockNumber: _blockNumber
        });

        bytes29 dataRoot = DABridgeMessage.formatDataRootBatch(_dataRoots).ref(
            0
        );
        assertEq(dataRoot.keccak(), manualDataRoot.keccak());
    }

    function test_getBlockNumber() public {
        DABridgeMessage.DataRootBatchItem[]
            memory _dataRoots = new DABridgeMessage.DataRootBatchItem[](1);

        _dataRoots[0] = DABridgeMessage.DataRootBatchItem({
            dataRoot: _dataRoot,
            blockNumber: _blockNumber
        });

        bytes29 dataRoot = DABridgeMessage.formatDataRootBatch(_dataRoots).ref(
            0
        );

        assertEq(
            uint256(_blockNumber),
            uint256(DABridgeMessage.dataRootBatch(dataRoot)[0].blockNumber)
        );
    }

    function test_getDataRoot() public {
        DABridgeMessage.DataRootBatchItem[]
            memory _dataRoots = new DABridgeMessage.DataRootBatchItem[](1);

        _dataRoots[0] = DABridgeMessage.DataRootBatchItem({
            dataRoot: _dataRoot,
            blockNumber: _blockNumber
        });

        bytes29 dataRoot = DABridgeMessage.formatDataRootBatch(_dataRoots).ref(
            0
        );

        assertEq(
            uint256(_dataRoot),
            uint256(DABridgeMessage.dataRootBatch(dataRoot)[0].dataRoot)
        );
    }
}
