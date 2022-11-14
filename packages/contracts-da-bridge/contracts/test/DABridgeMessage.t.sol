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
    uint256 private constant BLOCK_NUMBER_LEN = 4;
    uint256 private constant DATA_ROOT_LEN = 32;

    uint32 _blockNumber = type(uint32).max;
    bytes32 _dataRoot = keccak256("dataRoot");

    function setUp() public {}

    /// @notice Verify that the enum for the memview types remains unchaged
    function test_typeOrderUnchanged() public {
        assertEq(uint256(DABridgeMessage.Types.Invalid), 0);
        assertEq(uint256(DABridgeMessage.Types.DataRoot), 1);
    }

    /// @notice A DABridgeMessage must be IDENTIFIER_LEN + BLOCK_NUMBER_LEN + DATA_ROOT_LEN
    /// so that it can contain all the required information needed by the Bridge.
    function test_isValidMessageLength() public {
        bytes memory longMessage = new bytes(38);
        bytes memory correctMessage = new bytes(37);
        bytes memory shortMessage = new bytes(36);
        bytes29 longView = longMessage.ref(0);
        bytes29 correctView = correctMessage.ref(0);
        bytes29 shortView = shortMessage.ref(0);
        assertFalse(shortView.isValidDataRootLength());
        assertFalse(longView.isValidDataRootLength());
        assertTrue(correctView.isValidDataRootLength());
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
            uint40(DABridgeMessage.Types.DataRoot)
        );
        assertEq(
            uint256(viewUnderTest.messageType()),
            uint256(DABridgeMessage.Types.DataRoot)
        );
    }

    function test_detectsCorrectType() public {
        bytes memory message = abi.encodePacked(
            uint8(DABridgeMessage.Types.DataRoot),
            _blockNumber,
            _dataRoot
        );
        bytes29 _view = message.ref(0);
        assertFalse(_view.isDataRoot());
        _view = _view.getTypedView();
        assertTrue(_view.isDataRoot());
    }

    function test_assertsExistingType() public {
        bytes memory message = abi.encodePacked(
            uint8(255),
            _blockNumber,
            _dataRoot
        );
        bytes29 _view = message.ref(0);
        vm.expectRevert();
        _view.getTypedView();
    }

    function test_formatDataRootSucceeds() public {
        bytes29 manualDataRoot = abi
            .encodePacked(
                DABridgeMessage.Types.DataRoot,
                _blockNumber,
                _dataRoot
            )
            .ref(0);
        bytes29 dataRoot = DABridgeMessage
            .formatDataRoot(_blockNumber, _dataRoot)
            .ref(0);
        assertEq(dataRoot.keccak(), manualDataRoot.keccak());
    }

    function test_getBlockNumber() public {
        bytes29 dataRoot = DABridgeMessage
            .formatDataRoot(_blockNumber, _dataRoot)
            .ref(0);
        assertEq(
            uint256(_blockNumber),
            uint256(DABridgeMessage.blockNumber(dataRoot))
        );
    }

    function test_getDataRoot() public {
        bytes29 dataRoot = DABridgeMessage
            .formatDataRoot(_blockNumber, _dataRoot)
            .ref(0);
        assertEq(
            uint256(_dataRoot),
            uint256(DABridgeMessage.dataRoot(dataRoot))
        );
    }
}
