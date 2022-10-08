// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {MockWeth} from "./utils/MockWeth.sol";
import "forge-std/Test.sol";

// Tests are largely based on ERC20Test from solmate
// Thank you t11s et al.

contract BridgeTokenTest is Test {
    MockWeth token;

    bytes32 constant PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    function setUp() public {
        token = new MockWeth();
        token.setDetails("FAKE", "FK", 18);
        token.initialize();
    }

    function test_mint() public {
        token.mint(address(0xBEEF), 1e18);

        assertEq(token.totalSupply(), 1e18);
        assertEq(token.balanceOf(address(0xBEEF)), 1e18);
    }

    function test_mintOnlyOwner() public {
        token.mint(address(0xBEEF), 1e18);
        vm.startPrank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        token.mint(address(0xBEEF), 1e18);
        vm.stopPrank();
    }

    function test_burn() public {
        token.mint(address(0xBEEF), 1e18);
        token.burn(address(0xBEEF), 0.9e18);

        assertEq(token.totalSupply(), 1e18 - 0.9e18);
        assertEq(token.balanceOf(address(0xBEEF)), 1e18 - 0.9e18);
    }

    function test_burnOnlyOwner() public {
        token.mint(address(0xBEEF), 1e18);
        vm.startPrank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        token.burn(address(0xBEEF), 0.9e18);
        vm.stopPrank();
    }

    event UpdateDetails(
        string indexed name,
        string indexed symbol,
        uint8 indexed decimals
    );

    function test_setDetailsHash(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes(name).length,
                name,
                bytes(symbol).length,
                symbol,
                decimals
            )
        );
        token.setDetailsHash(hash);
        vm.expectEmit(true, true, true, false);
        emit UpdateDetails(name, symbol, decimals);
        token.setDetails(name, symbol, decimals);
    }

    function test_setDetailsHashOwner() public {
        bytes32 hash = "hash";
        vm.prank(address(0xBEEF));
        vm.expectRevert("Ownable: caller is not the owner");
        token.setDetailsHash(hash);
    }

    function test_transferOwnership() public {
        address newOwner = address(0xBEEF);
        token.transferOwnership(newOwner);
        assertEq(token.owner(), newOwner);
    }

    function test_transferOwnershipOnlyOwner() public {
        address newOwner = address(0xBEEF);
        vm.startPrank(newOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        token.transferOwnership(newOwner);
        vm.stopPrank();
    }

    function test_renounceOwnershipNoOp() public {
        token.renounceOwnership();
        uint256 gasAfter = gasleft();
        // hardcoded gas for noop after testing
        assertEq(gasAfter, 9223372036854747154);
    }
}
