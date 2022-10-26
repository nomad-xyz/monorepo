// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {NFTAccountant} from "../accountants/NFTAccountant.sol";
import {NFTRecoveryAccountantHarness} from "./harness/NFTAccountantHarness.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";

contract NFTAccountantTest is Test {
    address asset;
    address user;
    address recipient = vm.addr(111);
    uint256 amnt = 32000;
    ERC20Mock mockToken;
    NFTRecoveryAccountantHarness accountant;

    uint256 public constant AFFECTED_TOKEN_AMOUNT = 100_000_000;

    event ProcessFailure(
        uint256 indexed id,
        address indexed asset,
        address indexed recipient,
        uint256 amount
    );

    function setUp() public virtual {
        accountant = new NFTRecoveryAccountantHarness(address(this), recipient);
        accountant.initialize();
        // setup test vars
        user = vm.addr(90210);
        mockToken = new ERC20Mock("Fake", "FK", address(1), 0);
        asset = address(mockToken);
        accountant.exposed_setAffectedAmount(asset, AFFECTED_TOKEN_AMOUNT);
    }

    function test_initValues() public {
        // check initialized values once instead of for every test
        assertEq(accountant.owner(), address(this));
        assertEq(accountant.bridgeRouter(), address(this));
        assertEq(accountant.nextID(), 0);
        assertEq(accountant.totalMinted(asset), 0);
        (
            address _asset,
            uint96 _amount,
            address _originalUser,
            uint96 _recovered
        ) = accountant.records(0);
        assertEq(_asset, address(0));
        assertEq(uint256(_amount), 0);
        assertEq(_originalUser, address(0));
        assertEq(uint256(_recovered), 0);
        assertEq(accountant.totalAffected(asset), AFFECTED_TOKEN_AMOUNT);
        assertTrue(accountant.isAffectedAsset(asset));
        assertEq(accountant.totalRecovered(asset), 0);
    }

    function recordCheck() public {
        uint256 _id = accountant.nextID();
        uint256 _prevTotal = accountant.totalMinted(asset);
        // NFT does not exist before
        vm.expectRevert("ERC721: owner query for nonexistent token");
        accountant.ownerOf(_id);
        // calling record emits event
        vm.expectEmit(true, true, true, true, address(accountant));
        emit ProcessFailure(_id, asset, user, amnt);
        accountant.record(asset, user, amnt);
        // next NFT is minted to user
        assertEq(accountant.ownerOf(_id), user);
        // NFT has correct details
        (
            address nftAsset,
            uint96 nftAmount,
            address nftOriginalUser,
            uint96 nftRecovered
        ) = accountant.records(_id);
        assertEq(nftAsset, asset);
        assertEq(uint256(nftAmount), amnt);
        assertEq(nftOriginalUser, user);
        assertEq(uint256(nftRecovered), 0);
        // state variables are appropriately updated
        assertEq(accountant.nextID(), _id + 1);
        assertEq(accountant.totalMinted(asset), _prevTotal + amnt);
    }

    function test_recordCheck() public {
        recordCheck();
    }

    function test_mintTwoSameUser() public {
        recordCheck();
        recordCheck();
    }

    function test_mintTwoDifferentUser() public {
        recordCheck();
        user = vm.addr(12345);
        recordCheck();
    }

    function test_mintTwoDifferentAssets() public {
        recordCheck();
        asset = vm.addr(12345);
        accountant.exposed_setAffectedAmount(asset, AFFECTED_TOKEN_AMOUNT);
        recordCheck();
    }

    function test_dontMintMoreThanAffected() public {
        amnt = AFFECTED_TOKEN_AMOUNT * 2;
        vm.expectRevert("overmint");
        accountant.record(asset, user, amnt);
    }

    function test_dontMintRandomAsset() public {
        asset = vm.addr(99);
        vm.expectRevert("overmint");
        accountant.record(asset, user, amnt);
    }

    function test_noTransfers() public {
        recordCheck();
        vm.prank(user);
        vm.expectRevert("no transfers");
        accountant.transferFrom(user, vm.addr(99), 0);
        vm.expectRevert("no transfers");
        accountant.safeTransferFrom(user, vm.addr(99), 0);
        vm.expectRevert("no transfers");
        accountant.safeTransferFrom(user, vm.addr(99), 0, "0x1234");
    }
}
