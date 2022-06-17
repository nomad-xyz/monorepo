// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
//////////////////////////////////////////////////////////////*/
// Contracts to be upgraded
import { Home } from "../../contracts-core/contracts/Home.sol";
import { Replica } from "../../contracts-core/contracts/Replica.sol";
import { GovernanceRouter } from "../../contracts-core/contracts/governance/GovernanceRouter.sol";
import { BridgeRouter } from "../../contracts-bridge/contracts/BridgeRouter.sol";
import { BridgeToken } from "../../contracts-bridge/contracts/BridgeToken.sol";
import { TokenRegistry } from "../../contracts-bridge/contracts/TokenRegistry.sol";
// Utilities
import { GovernanceMessage } from "../../contracts-core/contracts/governance/GovernanceMessage.sol";
import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";
import { TypeCasts } from "../../contracts-core/contracts/libs/TypeCasts.sol";

contract Upgrade is Test {
  /*//////////////////////////////////////////////////////////////
                            UPGRADE ARGUMENTS
  //////////////////////////////////////////////////////////////*/

  // configuration
  uint32 domain;
  uint256 recoveryTimelock;
  // TODO: set to valid xAppConnectionManger
  address xAppConnectionManager;

  /*//////////////////////////////////////////////////////////////
                            DEPLOYED CONTRACTS
  //////////////////////////////////////////////////////////////*/

  Home home;
  Replica replica;
  GovernanceRouter governanceRouter;
  BridgeRouter bridgeRouter;
  TokenRegistry tokenRegistry;
  BridgeToken bridgeToken;

  /*//////////////////////////////////////////////////////////////
                              UPGRADE
  //////////////////////////////////////////////////////////////*/

  function deploy(uint32 _domain, string memory _domainName) public {
    domain = _domain;
    title("Upgrading Contracts on domain ", _domainName);
    vm.startBroadcast();
    deployImplementations();
    initializeImplementations();
    vm.stopBroadcast();
  }

  /*//////////////////////////////////////////////////////////////
                      IMPLEMENTATION DEPLOYMENT
  //////////////////////////////////////////////////////////////*/

  function deployImplementations() public {
    title("Deploying new implementations...");
    // Home
    home = new Home(domain);
    console2.log("home implementation address");
    console2.log(address(home));
    // Replica
    replica = new Replica(domain);
    console2.log("replica implementation address");
    console2.log(address(replica));
    // GovernanceRouter
    governanceRouter = new GovernanceRouter(domain, recoveryTimelock);
    console2.log("governanceRouter implementation address");
    console2.log(address(governanceRouter));
    // BridgeRouter
    bridgeRouter = new BridgeRouter();
    console2.log("bridgeRouter implementation address");
    console2.log(address(bridgeRouter));
    // TokenRegistry
    tokenRegistry = new TokenRegistry();
    console2.log("tokenRegistry implementation address");
    console2.log(address(tokenRegistry));
    // BridgeToken
    bridgeToken = new BridgeToken();
    console2.log("bridgeToken implementation address");
    console2.log(address(bridgeToken));
  }

  /*//////////////////////////////////////////////////////////////
                  IMPLEMENTATION INITIALIZATION
  //////////////////////////////////////////////////////////////*/

  function initializeImplementations() public {
    title("Initializing implementations with dummy values...");
    // NOTE: these init values do not map to correct expected values.
    // Storage variables in implementation contracts don't matter.
    // Purpose is to initialize the implementations as a matter of best practice,
    // despite the fact that in Nomad's architecture,
    // un-initialized implementations can't harm the protocol
    // (unless, in the future, we introduce delegatecall in any implementations)
    home.initialize(address(replica));
    replica.initialize(0, address(0), bytes32(0), 0);
    governanceRouter.initialize(xAppConnectionManager, address(0));
    tokenRegistry.initialize(address(bridgeToken), xAppConnectionManager);
    bridgeRouter.initialize(address(tokenRegistry), xAppConnectionManager);
    bridgeToken.initialize();
  }

  /*//////////////////////////////////////////////////////////////
                      CONSOLE.LOG UTILITIES
  //////////////////////////////////////////////////////////////*/

  function title(string memory title1) public {
    console2.log("===========================");
    console2.log(title1);
    console2.log("===========================");
  }

  function title(string memory title1, string memory title2) public {
    console2.log(" ");
    console2.log("===========================");
    console2.log(title1, title2);
    console2.log("===========================");
    console2.log(" ");
  }
}
