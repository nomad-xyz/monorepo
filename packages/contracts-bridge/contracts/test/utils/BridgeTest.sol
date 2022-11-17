// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// Test Contracts

import {MockHome} from "./MockHome.sol";
import {MockAccountant} from "./MockAccountant.sol";

// Bridge Contracts
import {EthereumBridgeRouterHarness} from "../harness/BridgeRouterHarness.sol";
import {BridgeRouterHarness} from "../harness/BridgeRouterHarness.sol";
import {IBridgeRouterHarness} from "../harness/IBridgeRouterHarness.sol";
import {TokenRegistryHarness} from "../harness/TokenRegistryHarness.sol";
import {TokenRegistry} from "../../TokenRegistry.sol";
import {BridgeToken} from "../../BridgeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";

// Upgrade Contracts
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";

// Contract-core Contracts
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "forge-std/Test.sol";

contract BridgeTestFixture is Test {
    using TypeCasts for bytes32;
    using TypeCasts for address;
    using TypeCasts for address payable;

    // Local variables
    uint256 mockUpdaterPK;
    address mockUpdater;
    address bridgeUser;
    uint32 localDomain;
    uint256 bridgeUserTokenAmount;

    // Remote variables
    bytes32 remoteBridgeRouter;
    uint32 remoteDomain;

    MockAccountant mockAccountant;
    MockHome mockHome;
    address mockReplica;
    IBridgeRouterHarness bridgeRouter;
    XAppConnectionManager xAppConnectionManager;
    UpgradeBeaconController upgradeBeaconController;
    UpgradeBeacon tokenBeacon;

    // Token Registry for all tokens in the domain
    TokenRegistryHarness tokenRegistry;
    BridgeToken bridgeToken;

    // Implementation contract for all tokens in the domain
    ERC20Mock localToken;
    address remoteTokenLocalAddress;
    bytes32 remoteTokenRemoteAddress;
    BridgeToken remoteToken;

    function setUp() public virtual {
        // Mocks
        // The Private Key numbers are random and of no significance. They
        // serve as a seed for the cheatcode to generate a pseudorandom address.
        mockUpdaterPK = 420;
        mockUpdater = vm.addr(mockUpdaterPK);
        bridgeUser = vm.addr(9305);
        remoteBridgeRouter = vm.addr(99123).addressToBytes32();
        bridgeUserTokenAmount = 10000;
        mockAccountant = new MockAccountant();

        localToken = new ERC20Mock(
            "Fake",
            "FK",
            bridgeUser,
            bridgeUserTokenAmount
        );
        localDomain = 1500;
        remoteDomain = 3000;
        remoteTokenRemoteAddress = address(0xBEEF).addressToBytes32();
        mockHome = new MockHome(localDomain);
        mockReplica = address(0xBEEFEFEEFEF);

        // Create implementations
        tokenRegistry = new TokenRegistryHarness();
        xAppConnectionManager = new XAppConnectionManager();
        upgradeBeaconController = new UpgradeBeaconController();
        bridgeToken = new BridgeToken();
        tokenBeacon = new UpgradeBeacon(
            address(bridgeToken),
            address(upgradeBeaconController)
        );
        // Tests that concern the EThereumBridgeRouter, they will already have called
        // setUpEthereumBridgeRouter(), which means that the address will not be address(0)
        if (address(bridgeRouter) == address(0)) {
            setUpBridgeRouter();
        }
        initializeContracts();
        initializeBridgeRouter();
        remoteTokenLocalAddress = createRemoteToken(
            remoteDomain,
            remoteTokenRemoteAddress
        );
    }

    function setUpEthereumBridgeRouter() public {
        mockAccountant = new MockAccountant();
        bridgeRouter = IBridgeRouterHarness(
            address(new EthereumBridgeRouterHarness(address(mockAccountant)))
        );
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

    /// @notice Create the representation of a remote token
    /// @param domain The remote domain
    /// @param remoteAddress The id of the remote token, which also happens
    /// to be the address of the token on that domain
    function createRemoteToken(uint32 domain, bytes32 remoteAddress)
        public
        returns (address)
    {
        address localAddress = tokenRegistry.exposed_deployToken(
            domain,
            remoteAddress
        );
        // The address is actually that of an UpgradeProxy that points
        // to the BridgeToken implementation
        remoteToken = BridgeToken(localAddress);
        assertEq(remoteToken.owner(), address(bridgeRouter));
        vm.startPrank(remoteToken.owner());
        remoteToken.mint(bridgeUser, bridgeUserTokenAmount);
        vm.stopPrank();
        return localAddress;
    }
}
