// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {NFTAccountant} from "../accountants/NFTAccountant.sol";
import {NFTRecoveryAccountantHarness} from "./harness/NFTAccountantHarness.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";

contract NFTAccountantTest is Test {
    address defaultAsset;
    address defaultUser;
    address recipient = vm.addr(111);
    uint256 defaultAmount = 32000;
    address bridgeRouter;
    ERC20Mock mockToken;
    NFTRecoveryAccountantHarness accountant;

    uint256 public constant AFFECTED_TOKEN_AMOUNT = 100_000_000;

    event ProcessFailure(
        uint256 indexed id,
        address indexed user,
        address indexed recipient,
        uint256 amount
    );

    function setUp() public virtual {
        setUp_vars();
        accountant = new NFTRecoveryAccountantHarness(bridgeRouter, recipient);
        accountant.initialize();
        setUp_mocks();
    }

    function setUp_vars() public {
        // setup test vars
        defaultUser = vm.addr(90210);
        mockToken = new ERC20Mock("Fake", "FK", address(1), 0);
        defaultAsset = address(mockToken);
        bridgeRouter = address(this);
    }

    function setUp_mocks() public {
        accountant.exposed_setAffectedAmount(
            defaultAsset,
            AFFECTED_TOKEN_AMOUNT
        );
    }

    function test_affectedAssets() public {
        address payable[14] memory affectedAssets = [
            0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599,
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            0x853d955aCEf822Db058eb8505911ED77F175b99e,
            0xdAC17F958D2ee523a2206206994597C13D831ec7,
            0x6B175474E89094C44Da98b954EedeAC495271d0F,
            0xD417144312DbF50465b1C641d016962017Ef6240,
            0x3d6F0DEa3AC3C607B3998e6Ce14b6350721752d9,
            0x40EB746DEE876aC1E78697b7Ca85142D178A1Fc8,
            0xf1a91C7d44768070F711c68f33A7CA25c8D30268,
            0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0,
            0x3431F91b3a388115F00C5Ba9FdB899851D005Fb5,
            0xE5097D9baeAFB89f9bcB78C9290d545dB5f9e9CB,
            0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871
        ];
        for (uint256 i; i < 14; i++) {
            assertEq(accountant.affectedAssets()[i], affectedAssets[i]);
        }
    }

    function test_isAffectedAsset() public {
        address payable[14] memory affectedAssets = [
            0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599,
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            0x853d955aCEf822Db058eb8505911ED77F175b99e,
            0xdAC17F958D2ee523a2206206994597C13D831ec7,
            0x6B175474E89094C44Da98b954EedeAC495271d0F,
            0xD417144312DbF50465b1C641d016962017Ef6240,
            0x3d6F0DEa3AC3C607B3998e6Ce14b6350721752d9,
            0x40EB746DEE876aC1E78697b7Ca85142D178A1Fc8,
            0xf1a91C7d44768070F711c68f33A7CA25c8D30268,
            0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0,
            0x3431F91b3a388115F00C5Ba9FdB899851D005Fb5,
            0xE5097D9baeAFB89f9bcB78C9290d545dB5f9e9CB,
            0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871
        ];
        for (uint256 i; i < 14; i++) {
            assertEq(accountant.isAffectedAsset(affectedAssets[i]), true);
        }
    }

    function test_recordOnlyBridgeRouter() public {
        address _user = defaultUser;
        address _asset = address(mockToken);
        uint256 _amount = 1000;
        vm.expectRevert("only BridgeRouter");
        vm.prank(address(0xBEEF));
        accountant.record(_asset, _user, _amount);
        // second one is executed with msg.sender = address(this)
        // which is the BridgeRouter
        accountant.record(_asset, _user, _amount);
    }

    function test_initValues() public {
        // check initialized values once instead of for every test
        assertEq(accountant.owner(), address(this));
        assertEq(accountant.bridgeRouter(), address(this));
        assertEq(accountant.nextID(), 0);
        assertEq(accountant.totalMinted(defaultAsset), 0);
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
        assertEq(accountant.totalAffected(defaultAsset), AFFECTED_TOKEN_AMOUNT);
        assertTrue(accountant.isAffectedAsset(defaultAsset));
        assertEq(accountant.totalRecovered(defaultAsset), 0);
        assertEq(accountant.name(), "Nomad NFT");
        assertEq(accountant.symbol(), "noNFT");
        assertEq(accountant.baseURI(), "https://nft.nomad.xyz/");
    }

    function recordCheckDefault() public {
        recordCheck(defaultUser, defaultAmount, defaultAsset);
    }

    function recordCheck(
        address _user,
        uint256 _amount,
        address _asset
    ) public {
        uint256 _id = accountant.nextID();
        uint256 _prevTotal = accountant.totalMinted(_asset);
        // NFT does not exist before
        vm.expectRevert("ERC721: owner query for nonexistent token");
        accountant.ownerOf(_id);
        // calling record emits event
        vm.expectEmit(true, true, true, true, address(accountant));
        emit ProcessFailure(_id, _asset, _user, _amount);
        accountant.record(_asset, _user, _amount);
        // next NFT is minted to user
        assertEq(accountant.ownerOf(_id), _user);
        // NFT has correct details
        (
            address nftAsset,
            uint96 nftAmount,
            address nftOriginalUser,
            uint96 nftRecovered
        ) = accountant.records(_id);
        assertEq(nftAsset, _asset);
        assertEq(uint256(nftAmount), _amount);
        assertEq(nftOriginalUser, _user);
        assertEq(uint256(nftRecovered), 0);
        // state variables are appropriately updated
        assertEq(accountant.nextID(), _id + 1);
        assertEq(accountant.totalMinted(_asset), _prevTotal + _amount);
    }

    function testFuzz_recordSuccess(
        uint8 assetIndex,
        address payable _user,
        uint256 _amount
    ) public {
        address payable _asset = checkUserAndGetAsset(_user, assetIndex);
        _amount = bound(_amount, 0, accountant.totalAffected(_asset));
        recordCheck(_user, _amount, _asset);
    }

    function test_recordSuccess() public {
        recordCheckDefault();
    }

    function test_recordSuccessForSameUserSameAssetTwice() public {
        recordCheckDefault();
        recordCheckDefault();
    }

    function test_recordSuccessForSameAssetDifferentUser() public {
        recordCheckDefault();
        defaultUser = vm.addr(12345);
        recordCheckDefault();
    }

    function test_recordSuccessForDifferentAssettsSameUser() public {
        recordCheckDefault();
        defaultAsset = vm.addr(12345);
        accountant.exposed_setAffectedAmount(
            defaultAsset,
            AFFECTED_TOKEN_AMOUNT
        );
        recordCheckDefault();
    }

    function test_recordRevertsIfOverMint() public {
        defaultAmount = AFFECTED_TOKEN_AMOUNT * 2;
        vm.expectRevert("overmint");
        accountant.record(defaultAsset, defaultUser, defaultAmount);
        defaultAmount = AFFECTED_TOKEN_AMOUNT;
        accountant.record(defaultAsset, defaultUser, defaultAmount);
    }

    function test_recordRevertsIfNotAffectedAsset() public {
        defaultAsset = vm.addr(99);
        vm.expectRevert("overmint");
        accountant.record(defaultAsset, defaultUser, defaultAmount);
    }

    function testFuzz_recordRevertsIfNotAffectedAsset(
        address _asset,
        address _user,
        uint256 _amount
    ) public {
        vm.assume(!accountant.isAffectedAsset(_asset));
        // Fuzz only for addresses that can in fact receive an ERC721
        // Filters through the address of the test contract, VM, and others.
        //
        // Create2Deployer
        vm.assume(canAcceptNft(_user));
        vm.assume(_amount != 0);
        if (_user != address(0)) {
            vm.expectRevert("overmint");
            accountant.record(_asset, _user, _amount);
        } else {
            vm.expectRevert("ERC721: mint to the zero address");
            accountant.record(_asset, _user, _amount);
        }
    }

    function test_transferReverts() public {
        recordCheckDefault();
        vm.prank(defaultUser);
        vm.expectRevert("no transfers");
        accountant.transferFrom(defaultUser, vm.addr(99), 0);
        vm.expectRevert("no transfers");
        accountant.safeTransferFrom(defaultUser, vm.addr(99), 0);
        vm.expectRevert("no transfers");
        accountant.safeTransferFrom(defaultUser, vm.addr(99), 0, "0x1234");
    }

    function testFuzz_transferReverts(
        address _user,
        address _receiver,
        uint256 _amount,
        uint8 _assetIndex
    ) public {
        address payable _asset = checkUserAndGetAsset(_user, _assetIndex);
        _amount = bound(_amount, 0, accountant.totalAffected(_asset));
        recordCheck(_user, _amount, _asset);
        vm.prank(_user);
        vm.expectRevert("no transfers");
        accountant.transferFrom(_user, _receiver, 0);
        vm.expectRevert("no transfers");
        accountant.safeTransferFrom(_user, _receiver, 0);
        vm.expectRevert("no transfers");
        accountant.safeTransferFrom(_user, _receiver, 0, "0x1234");
    }

    function checkUserAndGetAsset(address _user, uint8 _assetIndex)
        internal
        returns (address payable _asset)
    {
        vm.assume(canAcceptNft(_user));
        _assetIndex = uint8(bound(_assetIndex, 0, 13));
        _asset = accountant.affectedAssets()[_assetIndex];
    }

    function canAcceptNft(address _target) internal returns (bool _success) {
        (_success, ) = _target.call(
            abi.encodeWithSignature(
                "onERC721Received(address,address,uint256,bytes)",
                _target,
                address(0),
                0,
                ""
            )
        );
        _success =
            _success &&
            _target != 0x4e59b44847b379578588920cA78FbF26c0B4956C &&
            _target != address(0);
    }
}
