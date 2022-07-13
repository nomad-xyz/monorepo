// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {BridgeMessage} from "../BridgeMessage.sol";
import "forge-std/Test.sol";

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

    function addressToBytes32(address addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)) << 96);
    }

    function setUp() public {
        tokenAddress = addressToBytes32(
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
        );
        tokenName = "Fake Token";
        tokenSymbol = "FK";
        tokenDecimals = 18;

        tokenReceiver = addressToBytes32(
            0xd6A56d9f45683cDBEb1A3fcAdaca1fd78A352cd0
        );
        tokenSender = addressToBytes32(
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

    function test_isValidActionSuccess() public {
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

    function test_formatMessageFailNotAction() public {
        bytes memory bytesAction;
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
        bytes memory bytesAction;
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
        bytes memory bytesAction;
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
            uint40(BridgeMessage.Types.Transfer)
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

    function test_getDetailsCorrect() public {
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
}
