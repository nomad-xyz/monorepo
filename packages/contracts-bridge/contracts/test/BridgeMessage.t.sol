// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

/*//////////////////////////////////////////////////////////////
                           CONTRACTS
//////////////////////////////////////////////////////////////*/

import {BridgeMessage} from "../BridgeMessage.sol";

/*//////////////////////////////////////////////////////////////
                            LIBRARIES
//////////////////////////////////////////////////////////////*/

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/libs/TypeCasts.sol";

contract BridgeMessageTest is Test {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using BridgeMessage for bytes29;

    bytes32 tokenAddress;
    bytes32 tokenReceiver;
    bytes32 tokenSender;
    uint32 localDomain;
    uint32 remoteDomain;

    string tokenName;
    string tokenSymbol;
    uint8 tokenDecimals;
    bytes32 tokenDetailsHash;
    uint256 tokenAmount;

    uint256 TOKEN_ID_LEN = 36; // 4 bytes domain + 32 bytes id
    uint256 IDENTIFIER_LEN = 1;
    uint256 TRANSFER_LEN = 97; // 1 byte identifier + 32 bytes recipient + 32 bytes amount + 32 bytes detailsHash

    function setUp() public {
        tokenAddress = TypeCasts.addressToBytes32(
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
        );
        tokenName = "Fake Token";
        tokenSymbol = "FK";
        tokenDecimals = 18;

        tokenReceiver = TypeCasts.addressToBytes32(
            0xd6A56d9f45683cDBEb1A3fcAdaca1fd78A352cd0
        );
        tokenSender = TypeCasts.addressToBytes32(
            0x74de5d4FCbf63E00296fd95d33236B9794016631
        );
        localDomain = 1500;
        remoteDomain = 6000;
        tokenDetailsHash = "FK TOKEN";
        tokenAmount = 42069;
    }

    /// @notice Verify that the enum for the memview types remains unchaged
    function test_typeOrderUnchanged() public {
        assertEq(uint256(BridgeMessage.Types.Invalid), 0);
        assertEq(uint256(BridgeMessage.Types.TokenId), 1);
        assertEq(uint256(BridgeMessage.Types.Message), 2);
        assertEq(uint256(BridgeMessage.Types.Transfer), 3);
        assertEq(uint256(BridgeMessage.Types.DeprecatedFastTransfer), 4);
        assertEq(uint256(BridgeMessage.Types.TransferToHook), 5);
        assertEq(uint256(BridgeMessage.Types.ExtraData), 6);
    }

    function test_isValidActionSuccess() public pure {
        bytes29 transferAction = abi
            .encodePacked(BridgeMessage.Types.Transfer)
            .ref(uint40(BridgeMessage.Types.Transfer));
        bytes29 hookAction = abi
            .encodePacked(BridgeMessage.Types.TransferToHook)
            .ref(uint40(BridgeMessage.Types.TransferToHook));

        assert(BridgeMessage.isValidAction(transferAction));
        assert(BridgeMessage.isValidAction(hookAction));
    }

    function test_isValidActionRevertWrongViewType() public {
        bytes29 hookAction = abi
            .encodePacked(BridgeMessage.Types.TransferToHook)
            .ref(uint40(BridgeMessage.Types.Invalid));
        assertFalse(BridgeMessage.isValidAction(hookAction));
    }

    function test_isValidActionRevertWrongActionType() public {
        bytes29 hookAction = abi.encodePacked(BridgeMessage.Types.Invalid).ref(
            uint40(BridgeMessage.Types.TransferToHook)
        );
        assertFalse(BridgeMessage.isValidAction(hookAction));
    }

    function test_isValidActionRevertWrongActionTypeViewType() public {
        bytes29 hookAction = abi.encodePacked(BridgeMessage.Types.Invalid).ref(
            uint40(BridgeMessage.Types.Invalid)
        );
        assertFalse(BridgeMessage.isValidAction(hookAction));
    }

    /// @notice A BridgeMessage must be at least TOKEN_ID_LEN + MIN_TRANSFER_LEN
    /// so that it can contain all the required information needed by
    /// the Bridge. Apart from that, the upper bound is set by the
    /// Nomad Protocol itself.
    function test_isValidMessageLength() public {
        bytes memory longMessage = new bytes(9999999);
        bytes memory shortMessage = new bytes(10);
        bytes29 longView = longMessage.ref(0);
        bytes29 shortView = shortMessage.ref(0);
        assertFalse(BridgeMessage.isValidMessageLength(shortView));
        assertTrue(BridgeMessage.isValidMessageLength(longView));
    }

    function test_formatMessageFailNotAction() public {
        // I encode the correct type inside the data structure
        // but set the wrong type in the view
        // formatMessage() accepts only views of type "Transfer"
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Invalid));
        bytes29 tokenId = BridgeMessage.formatTokenId(
            localDomain,
            tokenAddress
        );
        vm.expectRevert("!action");
        BridgeMessage.formatMessage(tokenId, action);
    }

    function test_formatMessageNotTokenIdType() public {
        // I encode the correct type inside the data structure
        // but set the wrong type in the view
        // formatMessage() accepts only tokenId views of the type "TokenId"
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        bytes29 tokenId = abi.encodePacked(localDomain, tokenAddress).ref(
            uint40(BridgeMessage.Types.Invalid)
        );
        vm.expectRevert(
            "Type assertion failed. Got 0x0000000000. Expected 0x0000000001"
        );
        BridgeMessage.formatMessage(tokenId, action);
    }

    function test_formatMessageTransfer() public {
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        bytes29 tokenId = BridgeMessage.formatTokenId(
            localDomain,
            tokenAddress
        );
        bytes29 message = BridgeMessage.formatMessage(tokenId, action).ref(
            uint40(BridgeMessage.Types.Message)
        );
        uint256 actionLen = message.len() - TOKEN_ID_LEN;
        uint40 messageType = uint8(message.indexUint(TOKEN_ID_LEN, 1));
        bytes29 parsedAction = message.slice(
            TOKEN_ID_LEN,
            actionLen,
            messageType
        );
        bytes29 parsedTokenId = message.slice(
            0,
            TOKEN_ID_LEN,
            uint40(BridgeMessage.Types.TokenId)
        );
        assertEq(parsedAction.keccak(), action.keccak());
        assertEq(parsedTokenId.keccak(), tokenId.keccak());
    }

    function test_messageTypeReturnsCorrectType() public {
        bytes memory emptyMessage = new bytes(100);
        bytes29 emptyView = emptyMessage.ref(0); // Type 0
        bytes29 viewUnderTest;
        viewUnderTest = emptyView.castTo(uint40(BridgeMessage.Types.Invalid));
        assertEq(
            uint256(BridgeMessage.messageType(viewUnderTest)),
            uint256(BridgeMessage.Types.Invalid)
        );
        viewUnderTest = emptyView.castTo(uint40(BridgeMessage.Types.TokenId));
        assertEq(
            uint256(BridgeMessage.messageType(viewUnderTest)),
            uint256(BridgeMessage.Types.TokenId)
        );
        viewUnderTest = emptyView.castTo(uint40(BridgeMessage.Types.Message));
        assertEq(
            uint256(BridgeMessage.messageType(viewUnderTest)),
            uint256(BridgeMessage.Types.Message)
        );
    }

    function test_isTypeDetectsCorrectType() public view {
        bytes29 action;
        action = abi
            .encodePacked(
                BridgeMessage.Types.Message,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Message));
        assert(BridgeMessage.isType(action, BridgeMessage.Types.Message));
        action = abi
            .encodePacked(
                BridgeMessage.Types.TransferToHook,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash,
                tokenSender
            )
            .ref(uint40(BridgeMessage.Types.TransferToHook));
        assert(
            BridgeMessage.isType(action, BridgeMessage.Types.TransferToHook)
        );
        action = abi
            .encodePacked(
                BridgeMessage.Types.ExtraData,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.ExtraData));
        assert(BridgeMessage.isType(action, BridgeMessage.Types.ExtraData));
    }

    function test_isTransferSucceeds() public {
        bytes29 action;
        action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        assert(BridgeMessage.isTransfer(action));
        action = abi
            .encodePacked(
                BridgeMessage.Types.DeprecatedFastTransfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.DeprecatedFastTransfer));
        assertFalse(BridgeMessage.isTransfer(action));
    }

    function test_isTransferToHookSucceeds() public {
        bytes29 action;
        action = abi
            .encodePacked(
                BridgeMessage.Types.TransferToHook,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash,
                tokenSender
            )
            .ref(uint40(BridgeMessage.Types.TransferToHook));
        assert(BridgeMessage.isTransferToHook(action));
        action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        assertFalse(BridgeMessage.isTransferToHook(action));
    }

    function test_formatTransferSucceeds() public {
        bytes29 manualTransfer = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        bytes29 transfer = BridgeMessage.formatTransfer(
            tokenReceiver,
            tokenAmount,
            tokenDetailsHash
        );
        assertEq(transfer.keccak(), manualTransfer.keccak());
    }

    function test_formatTransferToHookSucceeds() public {
        bytes memory extraData = bytes("extra data");
        bytes29 manualTransfer = abi
            .encodePacked(
                BridgeMessage.Types.TransferToHook,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash,
                tokenSender,
                extraData
            )
            .ref(uint40(BridgeMessage.Types.TransferToHook));
        bytes29 transfer = BridgeMessage.formatTransferToHook(
            tokenReceiver,
            tokenAmount,
            tokenDetailsHash,
            tokenSender,
            extraData
        );
        assertEq(transfer.keccak(), manualTransfer.keccak());
    }

    function test_formatTokenIdFromDetails() public {
        bytes29 formated = abi.encodePacked(localDomain, tokenAddress).ref(
            uint40(BridgeMessage.Types.TokenId)
        );
        assertEq(
            BridgeMessage.formatTokenId(localDomain, tokenAddress).keccak(),
            formated.keccak()
        );
    }

    function test_formatTokenIdFromStruct() public {
        BridgeMessage.TokenId memory tokenId = BridgeMessage.TokenId(
            remoteDomain,
            tokenAddress
        );
        bytes29 formated = abi.encodePacked(remoteDomain, tokenAddress).ref(
            uint40(BridgeMessage.Types.TokenId)
        );
        assertEq(
            BridgeMessage.formatTokenId(tokenId).keccak(),
            formated.keccak()
        );
    }

    function test_getDetailsHashFromComponents() public {
        bytes32 details = keccak256(
            abi.encodePacked(
                bytes(tokenName).length,
                tokenName,
                bytes(tokenSymbol).length,
                tokenSymbol,
                tokenDecimals
            )
        );
        assertEq(
            BridgeMessage.getDetailsHash(tokenName, tokenSymbol, tokenDecimals),
            details
        );
    }

    function test_getDomainfromTokenId() public {
        bytes29 tokenId = BridgeMessage.formatTokenId(
            remoteDomain,
            tokenAddress
        );
        assertEq(uint256(BridgeMessage.domain(tokenId)), uint256(remoteDomain));
    }

    function test_getIDfromTokenId() public {
        bytes29 tokenId = BridgeMessage.formatTokenId(
            remoteDomain,
            tokenAddress
        );
        assertEq(BridgeMessage.id(tokenId), tokenAddress);
    }

    function test_getEvmIdfromTokenId() public {
        bytes29 tokenId = BridgeMessage.formatTokenId(
            remoteDomain,
            tokenAddress
        );
        assertEq(
            BridgeMessage.evmId(tokenId),
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
        );
    }

    function test_msgTypeCorrectType() public {
        // We need to set the correct memview type to action so that the
        // formatMessage function accepts the action
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        bytes29 tokenId = BridgeMessage.formatTokenId(
            localDomain,
            tokenAddress
        );
        // We explicitly set the wrong memview type to the message, that is '0'
        // to illustrate the the function under test extracts the type
        // of the action from the actual abi.enocePacked() payload and not the
        // the type metadata that lives with the memview view.
        bytes29 message = BridgeMessage.formatMessage(tokenId, action).ref(0);
        assertEq(
            uint256(BridgeMessage.msgType(message)),
            uint256(BridgeMessage.Types.Transfer)
        );
    }

    function test_actionTypeReturnsCorrectType() public {
        bytes29 action;
        action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(0);
        assertEq(
            uint256(BridgeMessage.actionType(action)),
            uint256(BridgeMessage.Types.Transfer)
        );

        action = abi
            .encodePacked(
                BridgeMessage.Types.DeprecatedFastTransfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(0);
        assertEq(
            uint256(BridgeMessage.actionType(action)),
            uint256(BridgeMessage.Types.DeprecatedFastTransfer)
        );

        action = abi
            .encodePacked(
                BridgeMessage.Types.TransferToHook,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash,
                tokenSender
            )
            .ref(0);
        assertEq(
            uint256(BridgeMessage.actionType(action)),
            uint256(BridgeMessage.Types.TransferToHook)
        );
    }

    function test_recipientReturnsCorrectBytes32() public {
        bytes29 action;
        action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        assertEq(BridgeMessage.recipient(action), tokenReceiver);
    }

    function test_evmRecipientReturnsCorrectAddress() public {
        bytes29 action;
        action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        assertEq(
            BridgeMessage.evmRecipient(action),
            TypeCasts.bytes32ToAddress(tokenReceiver)
        );
    }

    function test_amntReturnsCorrectAmount() public {
        bytes29 action;
        action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        assertEq(BridgeMessage.amnt(action), tokenAmount);
    }

    function test_detailsHashReturnsCorrectHash() public {
        bytes29 action;
        action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        assertEq(BridgeMessage.detailsHash(action), tokenDetailsHash);
    }

    function test_tokenIdReturnsCorrectId() public {
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        bytes29 tokenId = BridgeMessage.formatTokenId(
            localDomain,
            tokenAddress
        );
        bytes29 message = BridgeMessage.formatMessage(tokenId, action).ref(
            uint40(BridgeMessage.Types.Message)
        );
        assertEq(BridgeMessage.tokenId(message).keccak(), tokenId.keccak());
    }

    function test_evmHookReturnsCorrectAddress() public {
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.TransferToHook,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash,
                tokenSender,
                new bytes(100)
            )
            .ref(uint40(BridgeMessage.Types.TransferToHook));
        assertEq(
            BridgeMessage.evmHook(action),
            TypeCasts.bytes32ToAddress(tokenReceiver)
        );
    }

    function test_senderReturnsCorrectBytes32() public {
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.TransferToHook,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash,
                tokenSender,
                new bytes(100)
            )
            .ref(uint40(BridgeMessage.Types.TransferToHook));
        assertEq(BridgeMessage.sender(action), tokenSender);
    }

    function test_extraDataReturnsCorrectData() public {
        bytes memory manExtraData = bytes("Extra Data");
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.TransferToHook,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash,
                tokenSender,
                manExtraData
            )
            .ref(uint40(BridgeMessage.Types.TransferToHook));
        assertEq(
            BridgeMessage.extraData(action).keccak(),
            manExtraData.ref(0).keccak()
        );
    }

    function test_actionReturnsCorrectAction() public view {
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.TransferToHook,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash,
                tokenSender
            )
            .ref(uint40(BridgeMessage.Types.TransferToHook));
        assert(action.isType(BridgeMessage.Types.TransferToHook));
    }

    function test_tryAsMessageReturnsTypedMessage() public view {
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        bytes29 tokenId = BridgeMessage.formatTokenId(
            localDomain,
            tokenAddress
        );
        bytes29 message = BridgeMessage.formatMessage(tokenId, action).ref(0);
        bytes29 typedMessage = BridgeMessage.tryAsMessage(message);
        assert(typedMessage.isType(uint40(BridgeMessage.Types.Message)));
    }

    function test_tryAsMessageReturnsNullForInvalidMessage() public pure {
        bytes29 message = bytes("very smol message").ref(0);
        bytes29 typedMessage = BridgeMessage.tryAsMessage(message);
        assert(typedMessage.isNull());
    }

    function test_mustBeMessageRevertsForInvalidMsgSmall() public {
        bytes29 message = bytes("very smol message").ref(
            uint40(BridgeMessage.Types.Transfer)
        );
        vm.expectRevert("Validity assertion failed");
        message.mustBeMessage();
    }

    function test_mustBeMessageValidMessage() public view {
        bytes29 action = abi
            .encodePacked(
                BridgeMessage.Types.Transfer,
                tokenReceiver,
                tokenAmount,
                tokenDetailsHash
            )
            .ref(uint40(BridgeMessage.Types.Transfer));
        bytes29 tokenId = BridgeMessage.formatTokenId(
            localDomain,
            tokenAddress
        );
        bytes29 message = BridgeMessage.formatMessage(tokenId, action).ref(0);
        message.mustBeMessage();
    }
}
