// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {BridgeRouter} from "@nomad-xyz/contracts-bridge/contracts/BridgeRouter.sol";
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";
import {BridgeToken} from "@nomad-xyz/contracts-bridge/contracts/BridgeToken.sol";

import {Config} from "@nomad-xyz/contracts-ops/contracts/Config.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/libs/TypeCasts.sol";

import {Test, stdJson} from "forge-std/Test.sol";

contract UpgradeTest is Config, Test {
    using stdJson for string;
    using TypeCasts for bytes32;

    struct Batch {
        bytes data;
        address to;
    }

    string domain;
    uint32 domainNumber;

    bytes builtActions;

    Home homeImpl;
    Replica replicaImpl;
    GovernanceRouter govRouterImpl;
    BridgeRouter bridgeRouterImpl;
    TokenRegistry tokenRegistryImpl;
    BridgeToken bridgeTokenImpl;

    function setUp() public {
        string memory file = "production.json";
        __Config_initialize(file);
    }

    /// @notice Verify the state of Ethereum
    /// @dev The blockNumber is an arbitrary block number AFTER the deployment
    function test_verifyEthereum() public {
        domain = "ethereum";
        uint256 blockNumber = 16080528;
        domainNumber = getDomainNumber(domain);
        vm.createSelectFork(vm.envString("RPC_URL_ETHEREUM"), blockNumber);

        verifyConfigImplementations();
        readGovActions();
        executeGovActions();
        verifyGovActions();
    }

    /// @notice Verify the state of Avalanche
    /// @dev The blockNumber is an arbitrary block number AFTER the deployment
    function test_verifyAvalanche() public {
        domain = "avalanche";
        uint256 blockNumber = 23021186;
        domainNumber = getDomainNumber(domain);
        vm.createSelectFork(vm.envString("RPC_URL_AVALANCHE"), blockNumber);

        verifyConfigImplementations();
        readGovActions();
        executeGovActions();
        verifyGovActions();
    }

    /// @notice Verify the state of Xdai
    /// @dev The blockNumber is an arbitrary block number AFTER the deployment
    function test_verifyXDAI() public {
        domain = "xdai";
        uint256 blockNumber = 25226734;
        domainNumber = getDomainNumber(domain);
        vm.createSelectFork(vm.envString("RPC_URL_XDAI"), blockNumber);

        verifyConfigImplementations();
        readGovActions();
        executeGovActions();
        verifyGovActions();
    }

    /// @notice Verify the state of Evmos
    /// @dev The blockNumber is an arbitrary block number AFTER the deployment
    function test_verifyEvmos() public {
        domain = "evmos";
        uint256 blockNumber = 7892213;
        domainNumber = getDomainNumber(domain);
        vm.createSelectFork(vm.envString("RPC_URL_EVMOS"), blockNumber);

        verifyConfigImplementations();
        readGovActions();
        executeGovActions();
        verifyGovActions();
    }

    /// @notice Verify the state of Moonbeam
    /// @dev The blockNumber is an arbitrary block number AFTER the deployment
    function test_verifyMoonbeam() public {
        domain = "moonbeam";
        uint256 blockNumber = 2407153;
        domainNumber = getDomainNumber(domain);
        vm.createSelectFork(vm.envString("RPC_URL_MOONBEAM"), blockNumber);

        verifyConfigImplementations();
        readGovActions();
        executeGovActions();
        verifyGovActions();
    }

    /// @notice Verify the state of Milkomeda
    /// @dev The blockNumber is an arbitrary block number AFTER the deployment
    function test_milkomedaC1() public {
        domain = "milkomedaC1";
        uint256 blockNumber = 7355537;
        domainNumber = getDomainNumber(domain);
        vm.createSelectFork(vm.envString("RPC_URL_MILKOMEDAC1"), blockNumber);

        verifyConfigImplementations();
        readGovActions();
        executeGovActions();
        verifyGovActions();
    }

    /// @notice Verify that the implementations have been deployed at the addresses that exist
    /// in the configuration file.
    /// @dev To verify, we either call some constant that exists in the implementation, or a function that we
    /// expect to exist
    function verifyConfigImplementations() internal {
        // verify home
        homeImpl = Home(homeUpgrade(domain).implementation);
        assertEq(homeImpl.MAX_MESSAGE_BODY_BYTES(), 2 * 2**10);
        // verify replica
        string memory remote = getConnections(domain)[0];
        replicaImpl = Replica(replicaOfUpgrade(domain, remote).implementation);
        assertEq(replicaImpl.LEGACY_STATUS_PROVEN(), bytes32(uint256(1)));
        // verify gov router
        govRouterImpl = GovernanceRouter(
            governanceRouterUpgrade(domain).implementation
        );
        govRouterImpl.localDomain();
        // verify bridge router
        bridgeRouterImpl = BridgeRouter(
            payable(bridgeRouterUpgrade(domain).implementation)
        );
        assertEq(bridgeRouterImpl.DUST_AMOUNT(), 0.06 ether);
        // verify bridge token
        bridgeTokenImpl = BridgeToken(
            bridgeTokenUpgrade(domain).implementation
        );
        assertEq(
            bridgeTokenImpl._PERMIT_TYPEHASH(),
            keccak256(
                "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
            )
        );
        //verify token registry
        tokenRegistryImpl = TokenRegistry(
            tokenRegistryUpgrade(domain).implementation
        );
        tokenRegistryImpl.tokenBeacon();
    }

    /// @notice Verify the on-chain effects of executing the gov actions in the fork
    function verifyGovActions() internal {
        // Verify Updater rotation
        UpdaterManager updaterManager = getUpdaterManager(domain);
        assertEq(updaterManager.updater(), getUpdater(domain));

        // Verify Replica enrollment
        XAppConnectionManager cnMgr = getXAppConnectionManager(domain);
        string[] memory connections = getConnections(domain);
        for (uint256 i; i < connections.length; i++) {
            uint32 connectionDomain = getDomainNumber(connections[i]);
            address replica = address(getReplicaOf(domain, connections[i]));
            assertEq(cnMgr.replicaToDomain(replica), uint256(connectionDomain));
            assertEq(cnMgr.domainToReplica(connectionDomain), replica);

            // Verify Upfater rotation on replicas
            assertEq(Replica(replica).updater(), getUpdater(connections[i]));
        }

        // Verify new implementations have been set

        // Verify home implementation
        assertBeacon(address(homeUpgrade(domain).beacon), address(homeImpl));

        // Verify Replica implementation
        assertBeacon(
            address(replicaOfUpgrade(domain, getConnections(domain)[0]).beacon),
            address(replicaImpl)
        );

        // Verify Gov Router implementation
        assertBeacon(
            address(governanceRouterUpgrade(domain).beacon),
            address(govRouterImpl)
        );

        // Verify Bridge Router implementation
        assertBeacon(
            address(bridgeRouterUpgrade(domain).beacon),
            address(bridgeRouterImpl)
        );

        // Verify Bridge Token Implementation
        assertBeacon(
            address(bridgeTokenUpgrade(domain).beacon),
            address(bridgeTokenImpl)
        );

        // Verify Token Registry Implementation
        assertBeacon(
            address(tokenRegistryUpgrade(domain).beacon),
            address(tokenRegistryImpl)
        );
    }

    /// @notice Load implementation address from the beacon's storage and assert it's equal to the impl arg
    /// @param beacon The address of the beacon
    /// @param impl The address of the implementation
    function assertBeacon(address beacon, address impl) internal {
        address storedImpl = vm.load(beacon, bytes32(0)).bytes32ToAddress();
        assertEq(storedImpl, address(impl));
    }

    /// @notice Read the governance actions that we created during the Reboot
    /// @dev The gov actions are expected to be stored in a JSON file of the form
    /// "<domain_name>.json" in "actions/"
    function readGovActions() internal {
        string memory fileName = string(
            abi.encodePacked("actions/", domain, ".json")
        );
        string memory file = vm.readFile(fileName);
        string memory builtKey = string(
            abi.encodePacked(
                ".built.",
                vm.toString(uint256(domainNumber)),
                ".data"
            )
        );
        builtActions = abi.decode(file.parseRaw(builtKey), (bytes));
    }

    /// @notice Execute the built governance actions in recovery mode
    function executeGovActions() internal {
        GovernanceRouter govRouter = getGovernanceRouter(domain);
        if (govRouter.inRecovery()) {
            vm.startPrank(govRouter.recoveryManager());
        } else {
            vm.startPrank(govRouter.governor());
        }
        (bool _success, bytes memory _result) = address(govRouter).call(
            builtActions
        );
        vm.stopPrank();
        assertTrue(_success);
    }
}
