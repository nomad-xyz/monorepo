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
import {NFTRecoveryAccountantHarness} from "../harness/NFTAccountantHarness.sol";
import {TokenRegistry} from "../../TokenRegistry.sol";
import {BridgeToken} from "../../BridgeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";

// Upgrade Contracts
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";

// Contract-core Contracts
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "forge-std/Test.sol";

contract BridgeTestFixture is NomadTest {
    using TypeCasts for bytes32;
    using TypeCasts for address;
    using TypeCasts for address payable;

    // Fixtures
    address bridgeUser;
    uint256 bridgeUserTokenAmount;
    ERC20Mock localToken;

    // Mock-only state
    uint256 mockUpdaterPK;
    address mockUpdater;
    bytes32 remoteBridgeRouter;
    address mockReplica;

    address home;
    MockHome mockHome;

    // Real or mock
    TokenRegistryHarness tokenRegistry;
    IBridgeRouterHarness bridgeRouter;
    XAppConnectionManager xAppConnectionManager;
    UpgradeBeaconController upgradeBeaconController;
    UpgradeBeacon tokenBeacon;
    BridgeToken bridgeToken;

    // eth-only
    NFTRecoveryAccountantHarness accountant;

    // Implementation contract for all tokens in the domain
    address remoteTokenLocalAddress;
    bytes32 remoteTokenRemoteAddress;
    BridgeToken remoteToken;

    function setUp() public virtual override {
        NomadTest.setUp();
        setUp_mockState();
        setUp_testFixtures();
    }

    function prankReplica(uint32 _d) internal {
        vm.prank(xAppConnectionManager.domainToReplica(_d));
    }

    function prankReplica() internal {
        prankReplica(remoteDomain);
    }

    function remoteRouter(uint32 _d) internal view returns (bytes32) {
        return bridgeRouter.remotes(_d);
    }

    function remoteRouter() internal view returns (bytes32) {
        return remoteRouter(remoteDomain);
    }

    function setUp_testFixtures() public virtual {
        bridgeUserTokenAmount = 10000;
        bridgeUser = vm.addr(9305);
        remoteTokenRemoteAddress = address(0xBEEF).addressToBytes32();

        remoteTokenLocalAddress = createRemoteToken(
            remoteDomain,
            remoteTokenRemoteAddress
        );

        setUp_deployLocalToken();
    }

    function setUp_mockState() public {
        // Mocks
        // The Private Key numbers are random and of no significance. They
        // serve as a seed for the cheatcode to generate a pseudorandom address.
        mockUpdaterPK = 420;
        mockUpdater = vm.addr(mockUpdaterPK);
        remoteBridgeRouter = vm.addr(99123).addressToBytes32();
        accountant = NFTRecoveryAccountantHarness(
            address(new MockAccountant())
        );
        mockHome = new MockHome(homeDomain);
        home = address(mockHome);
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
    }

    function setUp_deployLocalToken() public {
        localToken = new ERC20Mock(
            "Fake",
            "FK",
            bridgeUser,
            bridgeUserTokenAmount
        );
    }

    function setUpEthereumBridgeRouter() public {
        accountant = NFTRecoveryAccountantHarness(
            address(new MockAccountant())
        );
        bridgeRouter = IBridgeRouterHarness(
            address(new EthereumBridgeRouterHarness(address(accountant)))
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
