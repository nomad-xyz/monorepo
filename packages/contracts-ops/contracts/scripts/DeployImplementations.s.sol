// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
//////////////////////////////////////////////////////////////*/
// Core contracts
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
// Bridge contracts
import {BridgeRouter} from "@nomad-xyz/contracts-bridge/contracts/BridgeRouter.sol";
import {BridgeToken} from "@nomad-xyz/contracts-bridge/contracts/BridgeToken.sol";
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";
// Interfaces
import {IUpdaterManager} from "@nomad-xyz/contracts-core/contracts/interfaces/IUpdaterManager.sol";
// Utilities
import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";

contract DeployImplementations is Test {
    /*//////////////////////////////////////////////////////////////
                            UPGRADE ARGUMENTS
  //////////////////////////////////////////////////////////////*/

    // configuration
    uint32 domain;
    uint256 recoveryTimelock;
    address xAppConnectionManager;
    address updaterManager;
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

    string path;

    function deploy(
        uint32 _domain,
        uint256 _recoveryTimelock,
        address _xAppConnectionManager,
        address _updaterManager
    ) external {
        domain = _domain;
        recoveryTimelock = _recoveryTimelock;
        xAppConnectionManager = _xAppConnectionManager;
        updaterManager = _updaterManager;
        title(
            "Deploying implementations on domain ",
            vm.toString(uint256(_domain))
        );
        path = string(
            abi.encodePacked(
                "actions/"
                "implementations-",
                vm.toString(uint256(_domain)),
                ".json"
            )
        );

        // Input validation
        require(domain != 0, "domain can't be zero");
        require(recoveryTimelock != 0, "recovery timelock can't be zero");
        require(
            xAppConnectionManager != address(0),
            "xAppConnectionManager can't be address(0)"
        );
        require(updaterManager != address(0), "updaterManager can't be 0");

        vm.startBroadcast();
        deployImplementations();
        // initializeImplementations();
        writeImpl();
        vm.stopBroadcast();
    }

    /*//////////////////////////////////////////////////////////////
                      IMPLEMENTATION DEPLOYMENT
  //////////////////////////////////////////////////////////////*/

    function deployImplementations() internal {
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

    function initializeImplementations() internal {
        title("Initializing implementations with dummy values...");
        // NOTE: these init values do not map to correct expected values.
        // Storage variables in implementation contracts don't matter.
        // Purpose is to initialize the implementations as a matter of best practice,
        // despite the fact that in Nomad's architecture,
        // un-initialized implementations can't harm the protocol
        // (unless, in the future, we introduce delegatecall in any implementations)
        home.initialize(IUpdaterManager(updaterManager));
        replica.initialize(0, address(0), bytes32(0), 0);
        governanceRouter.initialize(xAppConnectionManager, address(0));
        tokenRegistry.initialize(address(bridgeToken), xAppConnectionManager);
        bridgeRouter.initialize(address(tokenRegistry), xAppConnectionManager);
        bridgeToken.initialize();
    }

    /*//////////////////////////////////////////////////////////////
                      CONSOLE.LOG UTILITIES
  //////////////////////////////////////////////////////////////*/

    function title(string memory title1) internal {
        console2.log("===========================");
        console2.log(title1);
        console2.log("===========================");
    }

    function title(string memory title1, string memory title2) internal {
        console2.log(" ");
        console2.log("===========================");
        console2.log(title1, title2);
        console2.log("===========================");
        console2.log(" ");
    }

    function writeImpl() internal {
        string memory json = "{\n";
        // add home
        json = string(
            abi.encodePacked(
                json,
                '"home":',
                '"',
                vm.toString(address(home)),
                '",\n'
            )
        );
        //add replica
        json = string(
            abi.encodePacked(
                json,
                '"replica":',
                '"',
                vm.toString(address(replica)),
                '",\n'
            )
        );
        //add governanceRouter
        json = string(
            abi.encodePacked(
                json,
                '"governanceRouter":',
                '"',
                vm.toString(address(governanceRouter)),
                '",\n'
            )
        );
        //add tokenRegistry
        json = string(
            abi.encodePacked(
                json,
                '"tokenRegistry":',
                '"',
                vm.toString(address(tokenRegistry)),
                '",\n'
            )
        );
        //add bridgeRouter
        json = string(
            abi.encodePacked(
                json,
                '"bridgeRouter":',
                '"',
                vm.toString(address(bridgeRouter)),
                '",\n'
            )
        );
        //add bridgeToken
        json = string(
            abi.encodePacked(
                json,
                '"bridgeToken":',
                '"',
                vm.toString(address(bridgeToken)),
                '"\n}'
            )
        );
        console2.log(json);
        vm.writeFile(path, json);
    }
}
