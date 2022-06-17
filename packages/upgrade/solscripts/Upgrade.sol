// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
    //////////////////////////////////////////////////////////////*/

// Contracts to be upgraded
import { Home } from "../../contracts-core/contracts/Home.sol";
import { Replica } from "../../contracts-core/contracts/Replica.sol";
import { XAppConnectionManager } from "../../contracts-core/contracts/XAppConnectionManager.sol";
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

  uint32 domain;
  uint256 recoveryTimelock;

  // Beacon Addresses

  address homeBeacon;
  address replicaBeacon;
  address governanceRouterBeacon;
  address bridgeRouterBeacon;
  address tokenRegistryBeacon;
  address bridgeTokenBeacon;

  /*//////////////////////////////////////////////////////////////
                            UPGRADE CONTRACTS
    //////////////////////////////////////////////////////////////*/

  Home newHome;
  Replica newReplica;
  GovernanceRouter newGovernanceRouter;
  BridgeRouter newBridgeRouter;
  TokenRegistry newTokenRegistry;
  BridgeToken newBridgeToken;

  /*//////////////////////////////////////////////////////////////
                                 UPGRADE
    //////////////////////////////////////////////////////////////*/

  function upgrade(uint32 _domain, string memory _domainName) public {
    domain = _domain;
    title("Upgrading Contracts on domain ", _domainName);
    vm.startBroadcast();
    deployImplementations();
    vm.stopBroadcast();
  }

  /*//////////////////////////////////////////////////////////////
                        IMPLEMENTATION DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

  function deployImplementations() public {
    title("Deploying new implementations...");
    newHome = new Home(domain);
    console2.log("home implementation address");
    console2.log(address(newHome));
    newReplica = new Replica(domain);
    console2.log("replica implementation address");
    console2.log(address(newReplica));
    newGovernanceRouter = new GovernanceRouter(domain, recoveryTimelock);
    console2.log("governanceRouter implementation address");
    console2.log(address(newGovernanceRouter));
    newBridgeRouter = new BridgeRouter();
    console2.log("bridgeRouter implementation address");
    console2.log(address(newBridgeRouter));
    newTokenRegistry = new TokenRegistry();
    console2.log("tokenRegistry implementation address");
    console2.log(address(newTokenRegistry));
    newBridgeToken = new BridgeToken();
    console2.log("bridgeToken implementation address");
    console2.log(address(newBridgeToken));
  }

  /*//////////////////////////////////////////////////////////////
                                UTILITIES
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
