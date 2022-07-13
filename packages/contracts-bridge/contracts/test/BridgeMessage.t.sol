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
        remoteDomain = 3000;
    }

    function test_typeOrderUnchanged() public {
        assertEq(uint256(BridgeMessage.Types.Invalid), 0);
        assertEq(uint256(BridgeMessage.Types.TokenId), 1);
        assertEq(uint256(BridgeMessage.Types.Message), 2);
        assertEq(uint256(BridgeMessage.Types.Transfer), 3);
        assertEq(uint256(BridgeMessage.Types.DeprecatedFastTransfer), 4);
    }

    function test_isValidActionSuccess() public {}

    function test_formatTokenId() public {}

    function test_formatBridgeMessage() public {}

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
