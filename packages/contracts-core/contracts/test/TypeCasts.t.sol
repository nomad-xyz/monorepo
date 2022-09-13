// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import "../libs/TypeCasts.sol";

contract TypeCastsTest is Test {
    bytes32 addressRightPadded;
    bytes32 addressLeftPadded;
    address correctAddress;
    string largerString;
    string rightString;
    string smallerString;

    bytes32 testBytes32;

    using TypeCasts for string;
    using TypeCasts for bytes32;
    using TypeCasts for address;

    function setUp() public {
        addressRightPadded = vm.parseBytes32(
            "c014ba5ec014ba5ec014ba5ec014ba5ec014ba5e000000000000000000000000"
        );
        addressLeftPadded = vm.parseBytes32(
            "000000000000000000000000c014ba5ec014ba5ec014ba5ec014ba5ec014ba5e"
        );
        correctAddress = 0xC014BA5EC014ba5ec014Ba5EC014ba5Ec014bA5E;

        largerString = "33490c6ceeb450aecdc82e28293031d10c7d73bf85e57bf041a97360aa2c5d99c490c6ceeb450aecdc82e28293031d10c7d73bf85e57bf041a97360aa2c5d99c";
        rightString = "this is exactly 32 bytes, rofl!!";
        smallerString = "3490c6ceeb450a";

        testBytes32 = "I am a lonely bytes32";
    }

    function test_coerceBytes32() public {
        assertEq(
            rightString.coerceBytes32(),
            bytes32("this is exactly 32 bytes, rofl!!")
        );
        assertEq(smallerString.coerceBytes32(), "3490c6ceeb450a");
    }

    function test_coerceBytes32EmptyString() public {
        assertEq(string("").coerceBytes32(), bytes32(0));
    }

    function test_coerceBytes32ZeroString() public {
        assertEq(string("0").coerceBytes32(), bytes32("0"));
    }

    function test_coerceBytes32LargerRevert() public {
        vm.expectRevert(
            "TypedMemView/index - Attempted to index more than 32 bytes"
        );
        largerString.coerceBytes32();
    }

    function test_coerceString() public {
        assertEq(testBytes32.coerceString(), "I am a lonely bytes32");
    }

    function test_coerceStringZero() public {
        assertEq(bytes32(0).coerceString(), "");
    }

    function test_coerceStringZeroString() public {
        assertEq(bytes32("0").coerceString(), "0");
    }

    // left-padded is right aligned
    function test_addressToBytes32() public {
        assertEq(correctAddress.addressToBytes32(), addressLeftPadded);
    }

    function test_bytes32ToAddress() public {
        assertEq(addressLeftPadded.bytes32ToAddress(), correctAddress);
    }
}
