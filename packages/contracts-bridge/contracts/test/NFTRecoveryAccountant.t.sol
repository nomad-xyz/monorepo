// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {NFTAccountant} from "../accountants/NFTAccountant.sol";
import {NFTRecoveryAccountantHarness} from "./harness/NFTAccountantHarness.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";

contract NFTRecoveryAccountantTest is Test {
    address asset;
    address user;
    address recipient = vm.addr(111);
    uint256 amnt = 30_000_000;
    ERC20Mock mockToken;
    NFTRecoveryAccountantHarness accountant;

    uint256 public constant AFFECTED_TOKEN_AMOUNT = 100_000_000;
    uint256 public constant AMOUNT_ONE = 12_000_000;
    uint256 public constant AMOUNT_TWO = 8_000_000;

    event Recovery(
        uint256 indexed _tokenId,
        address indexed _asset,
        address indexed _user,
        uint256 _amount
    );

    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public virtual {
        accountant = new NFTRecoveryAccountantHarness(address(this), recipient);
        accountant.initialize();
        // setup test vars
        user = vm.addr(90210);
        mockToken = new ERC20Mock("Fake", "FK", address(1), 0);
        asset = address(mockToken);
        accountant.exposed_setAffectedAmount(asset, AFFECTED_TOKEN_AMOUNT);
    }

    function collectHelper(uint256 _amount) public {
        // mint tokens to a random handler
        // Adds modulo bias, but who cares
        address handler = vm.addr(_amount % 76);
        mockToken.mint(handler, _amount);
        // approve the accountant to spend the tokens
        vm.prank(handler);
        mockToken.approve(address(accountant), _amount);
        // call special collect function to move tokens into accountant
        accountant.collect(handler, address(mockToken), _amount);
    }

    function recoverCheck(uint256 _id) public {
        (address _asst, , , uint256 _recovered) = accountant.records(_id);
        uint256 _prevtotalRecovered = accountant.totalRecovered(_asst);
        uint256 _recoverable = accountant.recoverable(_id);
        address _user = accountant.ownerOf(_id);
        // recover
        vm.prank(_user);
        // expect Recovery event emitted
        vm.expectEmit(true, true, true, true, address(accountant));
        emit Recovery(_id, _asst, _user, _recoverable);
        accountant.exposed_recover(_id);
        // totalRecovered is now incremented
        assertEq(
            accountant.totalRecovered(_asst),
            _prevtotalRecovered + _recoverable
        );
        // recoverable is now zero
        assertEq(accountant.recoverable(_id), 0);
        // NFT's recovered field is incremented
        (, , , uint256 _newRecovered) = accountant.records(_id);
        assertEq(_newRecovered, _recovered + _recoverable);
        // owner doesn't change
        assertEq(accountant.ownerOf(_id), _user);
    }

    function test_recoverable() public {
        uint256 _id = 0;
        // recoverable() reverts for a non-existent token
        vm.expectRevert("recoverable: nonexistent token");
        accountant.recoverable(_id);
        // mint a few tokens
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        // recoverable is zero
        assertEq(accountant.recoverable(_id), 0);
        // transfer tokens outside of established process
        mockToken.mint(address(accountant), AMOUNT_ONE);
        // recoverable is still zero
        assertEq(accountant.recoverable(_id), 0);
        // collect funds through established process
        collectHelper(AMOUNT_ONE);
        assertEq(mockToken.balanceOf(address(accountant)), AMOUNT_ONE * 2);
        // recoverable is now non-zero
        assertEq(accountant.recoverable(_id), 3_600_000);
        // recover
        recoverCheck(_id);
        // recoverable is zero
        assertEq(accountant.recoverable(_id), 0);
        // collect more funds
        collectHelper(AMOUNT_TWO);
        // recoverable is non-zero
        assertEq(accountant.recoverable(_id), 2_400_000);
        // recover
        recoverCheck(_id);
        // recoverable is zero
        assertEq(accountant.recoverable(_id), 0);
    }

    function test_totalCollected() public {
        uint256 _id = 0;
        // totalCollected is zero
        assertEq(accountant.totalCollected(asset), 0);
        // mint a few tokens
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        // totalCollected is not changed
        assertEq(accountant.totalCollected(asset), 0);
        // transfer tokens outside of established process
        mockToken.mint(address(accountant), AMOUNT_ONE);
        // totalCollected is not changed
        assertEq(accountant.totalCollected(asset), 0);
        // collect funds through established process
        collectHelper(AMOUNT_ONE);
        // totalCollected is now equal to funds collected
        assertEq(accountant.totalCollected(asset), AMOUNT_ONE);
        // recover
        recoverCheck(_id);
        // recovering does not change totalCollected
        assertEq(accountant.totalCollected(asset), AMOUNT_ONE);
        // collect more funds
        collectHelper(AMOUNT_TWO);
        // totalCollected is now equal to total lifetime funds collected
        assertEq(accountant.totalCollected(asset), AMOUNT_ONE + AMOUNT_TWO);
    }

    function test_totalRecovered() public {
        // totalRecovered is zero
        assertEq(accountant.totalRecovered(asset), 0);
        // mint a few tokens
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        // totalRecovered is not changed
        assertEq(accountant.totalRecovered(asset), 0);
        // collect funds
        collectHelper(AMOUNT_ONE);
        // totalRecovered is not changed
        assertEq(accountant.totalRecovered(asset), 0);
        // transfer tokens outside of established process
        mockToken.mint(address(accountant), AMOUNT_ONE);
        // totalRecovered is not changed
        assertEq(accountant.totalRecovered(asset), 0);
        // recover
        for (uint256 _id = 0; _id < accountant.nextID(); _id++) {
            uint256 _prevtotalRecovered = accountant.totalRecovered(asset);
            uint256 _recoverable = accountant.recoverable(_id);
            // recover
            recoverCheck(_id);
            // totalRecovered is now incremented
            assertEq(
                accountant.totalRecovered(asset),
                _prevtotalRecovered + _recoverable
            );
        }
    }

    function test_recoverNonexistentToken() public {
        // recovering fails for nonexistent token
        vm.expectRevert("ERC721: owner query for nonexistent token");
        accountant.exposed_recover(1);
    }

    // can't recover if there's no funds in contract
    function test_recoverNoCollect() public {
        // mint token
        accountant.record(asset, user, amnt);
        vm.prank(user);
        // recovering fails with no collect
        vm.expectRevert("currently fully recovered");
        accountant.exposed_recover(0);
    }

    // collect -> recover -> recover FAIL (can't recover twice if there's no change in funds)
    function test_recoverTwiceNoCollect() public {
        // mint token
        accountant.record(asset, user, amnt);
        // collect funds
        collectHelper(AMOUNT_ONE);
        // recovering once works
        recoverCheck(0);
        // recovering the same token again before a collect doesn't work
        vm.prank(user);
        vm.expectRevert("currently fully recovered");
        accountant.exposed_recover(0);
    }

    // only NFT holder can call recover
    function test_onlyOwnerRecover() public {
        // mint token
        accountant.record(asset, user, amnt);
        // collect funds
        collectHelper(AMOUNT_ONE);
        // only NFT holder can recover
        vm.expectRevert("only NFT holder can recover");
        accountant.exposed_recover(0);
    }

    // mint -> collect -> recover
    function test_recoverOne() public {
        // mint token
        accountant.record(asset, user, amnt);
        // collect funds
        collectHelper(AMOUNT_ONE);
        // recover
        recoverCheck(0);
    }

    // collect -> mint -> recover
    function test_recoverTwo() public {
        // collect funds
        collectHelper(AMOUNT_ONE);
        // mint token
        accountant.record(asset, user, amnt);
        // recover
        recoverCheck(0);
    }

    // collect -> recover -> collect -> recover (can recover twice if there's more funds)
    function test_recoverContinuous() public {
        // mint token
        accountant.record(asset, user, amnt);
        // collect funds
        collectHelper(AMOUNT_ONE);
        // recover
        recoverCheck(0);
        // collect funds
        collectHelper(AMOUNT_ONE);
        // recover
        recoverCheck(0);
    }

    function test_remove() public {
        // collect funds within normal process
        collectHelper(30_000_000);
        // transfer tokens outside of established process
        mockToken.mint(address(accountant), 30_000_000);
        // remove sends funds to recipient
        vm.expectEmit(true, true, true, true, address(mockToken));
        emit Transfer(address(accountant), recipient, 15_000_000);
        accountant.remove(address(mockToken), 15_000_000);
        // recovering functions as normal afterward
        accountant.record(asset, user, 1_000_000);
        recoverCheck(0);
    }

    function test_removeOnlyOwner() public {
        // collect funds
        collectHelper(200);
        // prank non-owner address
        vm.prank(recipient);
        vm.expectRevert("Ownable: caller is not the owner");
        accountant.remove(address(mockToken), 100);
    }

    function test_collectSuccesfully() public {
        uint256 _amount = 123456;
        // mint tokens to a random handler
        address handler = vm.addr(112233);
        mockToken.mint(handler, _amount);
        // approve the accountant to spend the tokens
        vm.prank(handler);
        mockToken.approve(address(accountant), _amount);
        // totalCollected should start at zero
        assertEq(accountant.totalCollected(address(mockToken)), 0);
        // call special collect function to move tokens into accountant
        vm.expectEmit(true, true, true, true, address(mockToken));
        emit Transfer(handler, address(accountant), _amount);
        accountant.collect(handler, address(mockToken), _amount);
        // totalCollected should be incremented
        assertEq(accountant.totalCollected(address(mockToken)), _amount);
    }

    function testFuzz_collectSuccesfully(uint256 _amount, address handler)
        public
    {
        vm.assume(handler != address(0));
        mockToken.mint(handler, _amount);
        // approve the accountant to spend the tokens
        vm.prank(handler);
        mockToken.approve(address(accountant), _amount);
        // totalCollected should start at zero
        assertEq(accountant.totalCollected(address(mockToken)), 0);
        // call special collect function to move tokens into accountant
        vm.expectEmit(true, true, true, true, address(mockToken));
        emit Transfer(handler, address(accountant), _amount);
        accountant.collect(handler, address(mockToken), _amount);
        // totalCollected should be incremented
        assertEq(accountant.totalCollected(address(mockToken)), _amount);
    }

    function test_collectOnlyOwner() public {
        // prank non-owner address
        vm.prank(recipient);
        vm.expectRevert("Ownable: caller is not the owner");
        accountant.collect(user, address(mockToken), 100);
        // prank as a user with tokens
        uint256 _amount = 123;
        address handler = vm.addr(112233);
        mockToken.mint(user, _amount);
        vm.prank(user);
        mockToken.approve(address(accountant), _amount);
        accountant.collect(user, address(mockToken), 100);
    }

    // helper function to recover the full balance of the contract
    function recoverFullBalanceHelper(uint256 _balance) public {
        // loop through tokens to check recoverable amount
        uint256 _totalRecoverable;
        for (uint256 _id = 0; _id < accountant.nextID(); _id++) {
            _totalRecoverable += accountant.recoverable(_id);
        }
        assertEq(mockToken.balanceOf(address(accountant)), _balance);
        assertEq(_totalRecoverable, _balance);
        // loop through tokens to recover
        for (uint256 _id = 0; _id < accountant.nextID(); _id++) {
            recoverCheck(_id);
        }
        // accountant should be empty now
        assertEq(mockToken.balanceOf(address(accountant)), 0);
    }

    function test_recoverFullBalance() public {
        // mint tokens adding up to entire supply
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, AFFECTED_TOKEN_AMOUNT - (amnt * 3));
        // collect funds
        collectHelper(AMOUNT_ONE);
        // check the full balance is recoverable
        recoverFullBalanceHelper(AMOUNT_ONE);
        // collect more funds
        collectHelper(AMOUNT_TWO);
        // check the full balance is recoverable
        // a second time
        recoverFullBalanceHelper(AMOUNT_TWO);
    }

    // recovering the entire affected token amount is possible
    function test_recoverAffectedAmount() public {
        // mint tokens adding up to entire supply
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, AFFECTED_TOKEN_AMOUNT - (amnt * 3));
        // collect funds
        collectHelper(AFFECTED_TOKEN_AMOUNT);
        // check the full balance is recoverable
        recoverFullBalanceHelper(AFFECTED_TOKEN_AMOUNT);
    }

    // recovering even more than the affected token amount is possible
    // if collect more funds than affectedAssetAmounts
    function test_recoverOverAffectedAmount() public {
        // mint tokens adding up to entire supply
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, amnt);
        accountant.record(asset, user, AFFECTED_TOKEN_AMOUNT - (amnt * 3));
        // collect funds
        collectHelper(AFFECTED_TOKEN_AMOUNT * 2);
        // check the full balance is recoverable
        recoverFullBalanceHelper(AFFECTED_TOKEN_AMOUNT * 2);
    }
}
