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

    function getGovernor() external returns (address);

    function getGovernorDomain() external returns (uint256);

    function getUpdater(string memory domain) external returns (address);

    function getRecoveryManager(string memory domain)
        external
        returns (address);

    function getWatchers(string memory domain)
        external
        returns (address[] memory);

    /////////////////////*  BRIDGE ACTORS */////////////////////

    function getFundsRecipient(string memory domain) external returns (address);

    function getAccountantOwner(string memory domain)
        external
        returns (address);

    /////////////////////*  CONSTANTS */////////////////////

    function getNetworks() external returns (string[] memory);

    function getConnections(string memory domain)
        external
        returns (string[] memory);

    function getOptimisticSeconds(string memory domain)
        external
        returns (uint256);

    function getRecoveryTimelock(string memory domain)
        external
        returns (uint256);

    /////////////////////*  CORE CONTRACTS */////////////////////

    function getUpgradeBeaconController(string memory domain)
        external
        returns (UpgradeBeaconController);

    function getXAppConnectionManager(string memory domain)
        external
        returns (XAppConnectionManager);

    function getUpdaterManager(string memory domain)
        external
        returns (UpdaterManager);

    function getHome(string memory domain) external returns (Home);

    function homeUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function getGovernanceRouter(string memory domain)
        external
        returns (GovernanceRouter);

    function governanceRouterUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function getReplicaOf(string memory local, string memory remote)
        external
        returns (Replica);

    function replicaOfUpgrade(string memory local, string memory remote)
        external
        returns (Upgrade memory);

    /////////////////////*  BRIDGE CONTRACTS */////////////////////

    function getEthHelper(string memory domain) external returns (ETHHelper);

    function getBridgeRouter(string memory domain)
        external
        returns (BridgeRouter);

    function bridgeRouterUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function getTokenRegistry(string memory domain)
        external
        returns (TokenRegistry);

    function tokenRegistryUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function bridgeTokenUpgrade(string memory domain)
        external
        returns (Upgrade memory);

    function getAccountant(string memory domain)
        external
        returns (AllowListNFTRecoveryAccountant);

    function accountantUpgrade(string memory domain)
        external
        returns (Upgrade memory);
}
