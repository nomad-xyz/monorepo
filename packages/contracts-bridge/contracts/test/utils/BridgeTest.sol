// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// Test Contracts

import {MockHome} from "packages/contracts-bridge/contracts/test/utils/MockHome.sol";
import {MockAccountant} from "packages/contracts-bridge/contracts/test/utils/MockAccountant.sol";

// Interfaces
import {IBridgeRouterHarness} from "packages/contracts-bridge/contracts/test/harness/IBridgeRouterHarness.sol";

// Bridge Contracts
import {EthereumBridgeRouterHarness} from "../harness/BridgeRouterHarness.sol";
import {BridgeRouterHarness} from "../harness/BridgeRouterHarness.sol";
import {TokenRegistryHarness} from "../harness/TokenRegistryHarness.sol";
import {TokenRegistry} from "../../TokenRegistry.sol";
import {BridgeToken} from "../../BridgeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";

// Upgrade Contracts
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";

// Contract-core Contracts
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "forge-std/Test.sol";

contract BridgeTestFixture is Test {
    // Local variables
    uint256 mockUpdaterPK;
    address mockUpdater;
    address bridgeUser;
    uint32 localDomain;
    uint256 bridgeUserTokenAmount;

    // Remote variables
    bytes32 remoteBridgeRouter;
    uint32 remoteDomain;

    MockHome mockHome;
    address mockReplica;
    MockAccountant mockAccountant;

    XAppConnectionManager xAppConnectionManager;
    UpgradeBeaconController upgradeBeaconController;
    UpgradeBeacon tokenBeacon;
    // Token Registry for all tokens in the domain
    TokenRegistryHarness tokenRegistry;
    BridgeToken bridgeToken;
    IBridgeRouterHarness bridgeRouter;
    // Implementation contract for all tokens in the domain
    ERC20Mock localToken;
    address remoteTokenAddress;
    BridgeToken remoteToken;

    function setUp() public virtual {
        // Mocks
        // The Private Key numbers are random and of no significance. They
        // serve as a seed for the cheatcode to generate a pseudorandom address.
        mockUpdaterPK = 420;
        mockUpdater = vm.addr(mockUpdaterPK);
        bridgeUser = vm.addr(9305);
        remoteBridgeRouter = addressToBytes32(vm.addr(99123));
        bridgeUserTokenAmount = 10000;

        localToken = new ERC20Mock(
            "Fake",
            "FK",
            bridgeUser,
            bridgeUserTokenAmount
        );
        localDomain = 1500;
        remoteDomain = 3000;
        mockHome = new MockHome(localDomain);
        mockReplica = address(0xBEEEFFFFF);

        // Create implementations
        tokenRegistry = new TokenRegistryHarness();
        xAppConnectionManager = new XAppConnectionManager();
        upgradeBeaconController = new UpgradeBeaconController();
        bridgeToken = new BridgeToken();
        tokenBeacon = new UpgradeBeacon(
            address(bridgeToken),
            address(upgradeBeaconController)
        );
        // default bridgeRouter to nonEthereum
        if (address(bridgeRouter) == address(0)) {
            setUpBridgeRouter();
        }
        initializeContracts();
        initializeBridgeRouter();
        createRemoteToken();
    }

    function setUpEthereumBridgeRouter() public {
        mockAccountant = new MockAccountant();
        bridgeRouter = IBridgeRouterHarness(
            address(new EthereumBridgeRouterHarness(address(mockAccountant)))
        );
        // setup the BridgeTestFixture with an Ethereum Bridge Router
    }

    function setUpBridgeRouter() public {
        bridgeRouter = IBridgeRouterHarness(address(new BridgeRouterHarness()));
    }

    function initializeBridgeRouter() public virtual {
        bridgeRouter.initialize(
            address(tokenRegistry),
            address(xAppConnectionManager)
        );
        // The Token Registry should be owned by the Bridge Router
        bridgeRouter.enrollRemoteRouter(remoteDomain, remoteBridgeRouter);
    }

    function initializeContracts() public virtual {
        tokenRegistry.initialize(
            address(tokenBeacon),
            address(xAppConnectionManager)
        );
        tokenRegistry.transferOwnership(address(bridgeRouter));
        xAppConnectionManager.setHome(address(mockHome));
        xAppConnectionManager.ownerEnrollReplica(mockReplica, remoteDomain);
    }

    function createRemoteToken() public {
        remoteTokenAddress = tokenRegistry.deployToken(
            remoteDomain,
            addressToBytes32(vm.addr(999999999))
        );
        // The address is actually that of an UpgradeProxy that points
        // to the BridgeToken implementation
        remoteToken = BridgeToken(remoteTokenAddress);
        vm.startPrank(remoteToken.owner());
        remoteToken.mint(bridgeUser, bridgeUserTokenAmount);
        vm.stopPrank();
    }

    function addressToBytes32(address addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)) << 96);
    }
}
