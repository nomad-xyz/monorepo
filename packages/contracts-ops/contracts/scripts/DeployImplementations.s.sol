// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

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
import {Config} from "../Config.sol";
import {JsonWriter} from "../JsonWriter.sol";

contract DeployImplementations is Test, Config {
    using JsonWriter for JsonWriter.Buffer;

    /*//////////////////////////////////////////////////////////////
                            UPGRADE ARGUMENTS
  //////////////////////////////////////////////////////////////*/

    // configuration
    string localDomain;
    uint32 localDomainNumber;
    uint256 recoveryTimelock;
    address xAppConnectionManager;
    address updaterManager;
    JsonWriter.File outputFile;
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

    function deploy(string memory _localDomain, string memory _configPath)
        external
    {
        __Config_initialize(_configPath);
        localDomain = _localDomain;
        loadConfig();
        title(
            string(
                abi.encodePacked(
                    "Deploying  & Initializing implementations on domain: ",
                    _localDomain,
                    " : ",
                    vm.toString(uint256(localDomainNumber))
                )
            )
        );
        outputFile = JsonWriter.File(
            string(
                abi.encodePacked(
                    "actions/"
                    "implementations-",
                    localDomain,
                    ".json"
                )
            ),
            true
        );
        vm.startBroadcast();
        deployImplementations();
        writeImpl();
        vm.stopBroadcast();
    }

    function loadConfig() internal {
        recoveryTimelock = getGovernanceConfiguration(localDomain)
            .recoveryTimelock;
        xAppConnectionManager = address(getXAppConnectionManager(localDomain));
        updaterManager = address(getUpdaterManager(localDomain));
        localDomainNumber = uint32(domainNumber(localDomain));
        string memory rpc = getRpcs(localDomain)[0];
        vm.createFork(rpc);
        title("Input Data");
        console2.log("RPC:               ", rpc);
        console2.log("Timelock:          ", recoveryTimelock);
        console2.log("XCnMngr:           ", xAppConnectionManager);
        console2.log("UpdMngr:           ", updaterManager);
        console2.log("DomNubr:           ", uint256(localDomainNumber));

        // Input validation
        require(localDomainNumber != 0, "localDomainNumber can't be zero");
        require(recoveryTimelock != 0, "recovery timelock can't be zero");
        require(
            xAppConnectionManager != address(0),
            "xAppConnectionManager can't be address(0)"
        );
        require(
            updaterManager != address(0),
            "updaterManager can't be address(0)"
        );
    }

    /*//////////////////////////////////////////////////////////////
                      IMPLEMENTATION DEPLOYMENT
  //////////////////////////////////////////////////////////////*/

    function deployImplementations() internal {
        // NOTE: these init values do not map to correct expected values.
        // Storage variables in implementation contracts don't matter.
        // Purpose is to initialize the implementations as a matter of best practice,
        // despite the fact that in Nomad's architecture,
        // un-initialized implementations can't harm the protocol
        // (unless, in the future, we introduce delegatecall in any implementations)
        // Home

        home = new Home(localDomainNumber);
        home.initialize(IUpdaterManager(updaterManager));
        console2.log("Home deployed at", address(home));

        // Replica
        replica = new Replica(localDomainNumber);
        replica.initialize(0, address(0), bytes32(0), 0);
        console2.log("Replica deployed at", address(replica));

        // GovernanceRouter
        governanceRouter = new GovernanceRouter(
            localDomainNumber,
            recoveryTimelock
        );
        governanceRouter.initialize(xAppConnectionManager, address(0));
        console2.log("Governance Router deploed at", address(governanceRouter));

        // BridgeRouter
        bridgeRouter = new BridgeRouter();
        bridgeRouter.initialize(address(tokenRegistry), xAppConnectionManager);
        console2.log("Bridge Router deployed at", address(bridgeRouter));

        tokenRegistry = new TokenRegistry();
        tokenRegistry.initialize(address(bridgeToken), xAppConnectionManager);
        console2.log("Token Registry deployed at", address(tokenRegistry));

        // BridgeToken
        bridgeToken = new BridgeToken();
        bridgeToken.initialize();
        console2.log("Bridge Token deployed at", address(bridgeToken));
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
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        string memory indent = "";
        string[2][] memory kvs = new string[2][](6);
        kvs[0][0] = "home";
        kvs[0][1] = vm.toString(address(home));
        kvs[1][0] = "replica";
        kvs[1][1] = vm.toString(address(replica));
        kvs[2][0] = "governanceRouter";
        kvs[2][1] = vm.toString(address(governanceRouter));
        kvs[3][0] = "tokenRegistry";
        kvs[3][1] = vm.toString(address(tokenRegistry));
        kvs[4][0] = "bridgeRouter";
        kvs[4][1] = vm.toString(address(bridgeRouter));
        kvs[5][0] = "bridgeToken";
        kvs[5][1] = vm.toString(address(bridgeToken));
        buffer.writeSimpleObject(indent, "", kvs, true);
        buffer.flushTo(outputFile);
    }
}
