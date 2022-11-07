// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

// Core imports
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconProxy} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconProxy.sol";
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
// Bridge imports
import {BridgeRouter} from "@nomad-xyz/contracts-bridge/contracts/BridgeRouter.sol";
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";
import {ETHHelper} from "@nomad-xyz/contracts-bridge/contracts/ETHHelper.sol";
import {AllowListNFTRecoveryAccountant} from "@nomad-xyz/contracts-bridge/contracts/accountants/NFTAccountant.sol";

// NomadProtocol defined the interface for a full set of Nomad Contracts.
// This common interface can be instantiated for mainnet fork tests or local integration tests
// The common structure allows sharing test cases between fork & integration tests
interface INomadProtocol {
    struct Upgrade {
        UpgradeBeacon beacon;
        address implementation;
        UpgradeBeaconProxy proxy;
    }

    /////////////////////*  CORE ACTORS */////////////////////

    function governor() external returns (address);

    function governorDomain() external returns (uint256);

    function updater(string memory domain) external returns (address);

    function recoveryManager(string memory domain) external returns (address);

    function watchers(string memory domain) external returns (address[] memory);

    /////////////////////*  BRIDGE ACTORS */////////////////////

    function fundsRecipient(string memory domain) external returns (address);

    function accountantOwner(string memory domain) external returns (address);

    /////////////////////*  CONSTANTS */////////////////////

    function networks() external returns (string[] memory);

    function connections(string memory domain)
        external
        returns (string[] memory);

    function optimisticSeconds(string memory domain) external returns (uint256);

    function recoveryTimelock(string memory domain) external returns (uint256);

    /////////////////////*  CORE CONTRACTS */////////////////////

    function upgradeBeaconController(string memory domain)
        external
        returns (UpgradeBeaconController);

    function xAppConnectionManager(string memory domain)
        external
        returns (XAppConnectionManager);

    function updaterManager(string memory domain)
        external
        returns (UpdaterManager);

    function home(string memory domain) external returns (Home);

    function homeUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function governanceRouter(string memory domain)
        external
        returns (GovernanceRouter);

    function governanceRouterUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function replicaOf(string memory local, string memory remote)
        external
        returns (Replica);

    function replicaOfUpgrade(string memory local, string memory remote)
        external
        returns (Upgrade memory);

    /////////////////////*  BRIDGE CONTRACTS */////////////////////

    function ethHelper(string memory domain) external returns (ETHHelper);

    function bridgeRouter(string memory domain) external returns (BridgeRouter);

    function bridgeRouterUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function tokenRegistry(string memory domain)
        external
        returns (TokenRegistry);

    function tokenRegistryUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function bridgeTokenUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function accountant(string memory domain)
        external
        returns (AllowListNFTRecoveryAccountant);

    function accountantUpgrade(string memory domain)
        external
        returns (Upgrade memory);
}
