// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/libs/TypeCasts.sol";
import {BridgeRouterBaseTest} from "./BridgeRouterBase.t.sol";

contract EthereumBridgeRouterTest is BridgeRouterBaseTest {
    using TypeCasts for bytes32;
    using TypeCasts for address payable;
    using TypeCasts for address;

    function setUp() public virtual override {
        setUpEthereumBridgeRouter();
        super.setUp();
    }

    function test_isAffectedAsset() public view {
        address payable[14] memory affected = accountant.affectedAssets();
        for (uint256 i = 0; i < affected.length; i++) {
            require(accountant.isAffectedAsset(affected[i]));
        }
    }

    event MockAcctCalled(
        address indexed _asset,
        address indexed _user,
        uint256 _amount
    );

    function test_giveLocalUnaffected() public {
        uint256 amount = 1000;
        address recipient = address(33);
        // test with localtoken
        localToken.mint(address(bridgeRouter), amount);
        vm.expectEmit(true, true, false, true, address(localToken));
        emit Transfer(address(bridgeRouter), recipient, amount);
        bridgeRouter.exposed_giveLocal(address(localToken), amount, recipient);

        // test with each affected tokens
        // This checks for events on the mock accountant
        // Accountant logic is tested separately
        address payable[14] memory affected = accountant.affectedAssets();
        for (uint256 i = 0; i < affected.length; i++) {
            address a = affected[i];
            vm.expectEmit(
                true,
                true,
                false,
                true,
                address(bridgeRouter.accountant())
            );
            emit MockAcctCalled(a, recipient, amount);
            bridgeRouter.exposed_giveLocal(a, amount, recipient);
        }
    }

    function test_exitBridgeOnly() public {
        address payable[14] memory affected = accountant.affectedAssets();
        for (uint256 i = 0; i < affected.length; i++) {
            vm.expectRevert();
            bridgeRouter.send(
                affected[i],
                1,
                receiverDomain,
                tokenReceiver,
                fastLiquidityEnabled
            );
        }
    }
}
