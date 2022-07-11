// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// Bridge
import {BridgeRouter} from "../../BridgeRouter.sol";
import {TokenRegistry} from "../../TokenRegistry.sol";
import {BridgeToken} from "../../BridgeToken.sol";
//
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";

import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "forge-std/Test.sol";
import "forge-std/console2.sol";

contract BridgeTest is Test {
    uint256 mockUpdaterPK;
    address mockUpdater;

    BridgeRouter bridgeRouter;
    UpgradeBeacon tokenBeacon;
    XAppConnectionManager xAppConnectionManager;
    UpgradeBeaconController upgradeBeaconController;
    // Token Registry for all tokens in the domain
    TokenRegistry tokenRegistry;
    // Implementation contract for all tokens in the domain
    BridgeToken bridgeToken;

    function setUp() public virtual {
        mockUpdaterPK = 420;
        mockUpdater = vm.addr(mockUpdaterPK);

        // Create implementations
        bridgeRouter = new BridgeRouter();
        tokenRegistry = new TokenRegistry();
        bridgeToken = new BridgeToken();
        xAppConnectionManager = new XAppConnectionManager();
        upgradeBeaconController = new UpgradeBeaconController();

        tokenBeacon = new UpgradeBeacon(
            address(bridgeToken),
            address(upgradeBeaconController)
        );
        initializeContracts();
    }

    function initializeContracts() public {
        tokenRegistry.initialize(
            address(tokenBeacon),
            address(xAppConnectionManager)
        );
        bridgeRouter.initialize(
            address(tokenRegistry),
            address(xAppConnectionManager)
        );
    }

    function addressToBytes32(address addr) public returns (bytes32) {
        return bytes32(uint256(uint160(addr)) << 96);
    }
}
