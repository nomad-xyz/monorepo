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

contract Upgrade is Test{

    /*//////////////////////////////////////////////////////////////
                            UPGRADE ARGUMENTS
    //////////////////////////////////////////////////////////////*/

   uint32 domain;
   string domainName;
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
                            GOVERNANCE CALLS
    //////////////////////////////////////////////////////////////*/

   bytes upgradeHome;
   bytes upgradeReplica;
   bytes upgradeGovRouter;
   bytes upgradeBridgeRouter;
   bytes upgradeTokenRegistry;
   bytes upgradeBridgeToken;

   address beaconController;

   bytes executeCallBatchCall;

    /*//////////////////////////////////////////////////////////////
                                 UPGRADE
    //////////////////////////////////////////////////////////////*/


    function upgrade(uint32 _domain, string memory _domainName) public {
        domain = _domain;
        domainName = _domainName;
        title("Upgrading Contracts on domain ", domainName);
        vm.startBroadcast();
        deployImplementations();
        vm.stopBroadcast();
        // Get contract addresses
        env_getBeaconAddresses();
        env_getUpgradeAddresses();
        // Print useful information to user
        generateGovernanceCalls();
        generateExecuteCallBatchCall();
    }

    /*//////////////////////////////////////////////////////////////
                        IMPLEMENTATION DEPLOYMENT
    //////////////////////////////////////////////////////////////*/

    function deployImplementations() public {
        title("Deploying new implementations...");
        newHome = new Home(domain);
        console2.log("Home deployed at", address(newHome));
        newReplica = new Replica(domain);
        console2.log("Replica deployed at", address(newReplica));
        newGovernanceRouter = new GovernanceRouter(domain, recoveryTimelock);
        console2.log("Governance Router deployed at", address(newGovernanceRouter));
        newBridgeRouter = new BridgeRouter();
        console2.log("Bridge Router deployed at", address(newBridgeRouter));
        newTokenRegistry = new TokenRegistry();
        console2.log("Token Registry deployed at", address(newTokenRegistry));
        newBridgeToken = new BridgeToken();
        console2.log("Bridge Token deployed", address(newBridgeToken));
    }


    /*//////////////////////////////////////////////////////////////
                             ENV VAR GETTERS
    //////////////////////////////////////////////////////////////*/

    function env_getBeaconAddresses() public{
        homeBeacon = vm.envAddress("NOMAD_HOME_BEACON");
        replicaBeacon = vm.envAddress("NOMAD_REPLICA_BEACON");
        governanceRouterBeacon = vm.envAddress("NOMAD_GOVERNANCE_ROUTER_BEACON");
        bridgeRouterBeacon = vm.envAddress("NOMAD_BRIDGE_ROUTER_BEACON");
        tokenRegistryBeacon = vm.envAddress("NOMAD_TOKEN_REGISTRY_BEACON");
        bridgeTokenBeacon = vm.envAddress("NOMAD_BRIDGE_ROUTER_BEACON");
        recoveryTimelock = vm.envUint("NOMAD_RECOVERY_TIMELOCK");
    }


    function env_getUpgradeAddresses() public {
        beaconController = vm.envAddress("NOMAD_BEACON_CONTROLLER");
    }


    /*//////////////////////////////////////////////////////////////
                       GOVERNANCE CALL GENERATORS
    //////////////////////////////////////////////////////////////*/

    function generateGovernanceCalls() public {
        title("BeaconController upgrade encoded calls");
        console2.log("Function signature: upgrade(address, address)");
        console2.log("Arguments: <contract_beacon>, <new_implementation_address>");

        upgradeHome = abi.encodeWithSignature("upgrade(address, address)", homeBeacon, address(newHome));
        console2.log("Upgrade Home");
        console2.logBytes(upgradeHome);

        upgradeReplica = abi.encodeWithSignature("upgrade(address, address)", replicaBeacon, address(newReplica));
        console2.log("Upgrade Replica");
        console2.logBytes(upgradeReplica);

        upgradeGovRouter = abi.encodeWithSignature("upgrade(address, address)", governanceRouterBeacon, address(newGovernanceRouter));
        console2.log("Upgrade Governance Router");
        console2.logBytes(upgradeGovRouter);

        upgradeBridgeRouter = abi.encodeWithSignature("upgrade(address, address)", bridgeRouterBeacon, address(newBridgeRouter));
        console2.log("Upgrade Bridge Router");
        console2.logBytes(upgradeBridgeRouter);

        upgradeTokenRegistry = abi.encodeWithSignature("upgrade(address, address)", tokenRegistryBeacon, address(newTokenRegistry));
        console2.log("Upgrade Token Registry");
        console2.logBytes(upgradeTokenRegistry);

        upgradeBridgeToken = abi.encodeWithSignature("upgrade(address, address)", bridgeTokenBeacon, address(newBridgeToken));
        console2.log("Upgrade Bridge Token");
        console2.logBytes(upgradeBridgeToken);
    }


    function generateExecuteCallBatchCall() public {
        GovernanceMessage.Call[] memory batch = new GovernanceMessage.Call[](6);
        batch[0] = genGovCall(beaconController, upgradeHome);
        batch[1] = genGovCall(beaconController, upgradeReplica);
        batch[2] = genGovCall(beaconController, upgradeGovRouter);
        batch[3] = genGovCall(beaconController, upgradeBridgeRouter);
        batch[4] = genGovCall(beaconController, upgradeTokenRegistry);
        batch[5] = genGovCall(beaconController, upgradeBridgeToken);
        executeCallBatchCall = abi.encodeWithSignature("executeCallBatch(GovernanceMessage.Call[])", batch);
        title("ExecuteCallBatch call");
        console2.log("function signature: executeCallBatch(GovernanceMessage.Call[] calldata _calls)");
        console2.log("GovernanceMessage.Call signature:  struct Call { bytes32 to; bytes data;}");
        console2.log("Call attributes: <beacon_controller_address, <beacon_controller_upgraded_encoded_call_for_implementation>");
        console2.log("executeCallBatch-artifact");
        console2.logBytes(executeCallBatchCall);
    }


    function genGovCall(address _to,bytes memory _data) public returns(GovernanceMessage.Call memory) {
          return GovernanceMessage.Call({
            to: TypeCasts.addressToBytes32(_to),
            data: _data
        });
    }

    /*//////////////////////////////////////////////////////////////
                                UTILITIES
    //////////////////////////////////////////////////////////////*/

    function title(string memory title1) public{
        console2.log("===========================");
        console2.log(title1);
        console2.log("===========================");
    }

    function title(string memory title1, string memory title2) public{
        console2.log(" ");
        console2.log("===========================");
        console2.log(title1, title2);
        console2.log("===========================");
        console2.log(" ");
    }

}


contract UpgradeActions is Test {
    function executeCallBatchCall(string memory domain) public {
        bytes memory callData = vm.envBytes("NOMAD_CALL_BATCH");
        address govRouter = vm.envAddress("NOMAD_GOV_ROUTER");
        vm.startBroadcast();
        (bool success, bytes memory returnData) = govRouter.call(callData);
        vm.stopBroadcast();
        require(success, "ExecuteCallBatch failed");
    }
}
