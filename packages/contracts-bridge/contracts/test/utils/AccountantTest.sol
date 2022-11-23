// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";

import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
import {NFTRecoveryAccountantHarness} from "../harness/NFTAccountantHarness.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";

contract AccountantTest is NomadTest {
    address defaultAsset;
    address defaultUser;
    address fundsRecipient = vm.addr(111);
    NFTRecoveryAccountantHarness accountant;
    uint256 defaultAmount = 32000;

    address bridgeRouter;
    ERC20Mock mockToken;

    uint256 public constant AFFECTED_TOKEN_AMOUNT = 100_000_000;

    function setUp() public virtual override {
        setUp_vars();
        accountant = new NFTRecoveryAccountantHarness(
            bridgeRouter,
            fundsRecipient
        );
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
}
