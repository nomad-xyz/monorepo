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

contract RebootVerifyTest is Config, Test {
    using stdJson for string;
    using TypeCasts for bytes32;

    struct Batch {
        bytes data;
        address to;
    }

    string domain;
    uint32 domainNumber;

    Batch[] localActions;
    Batch[] remoteActions;
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
        }

        // Verify new implementations have been set

        // Verify home implementation
        address storedHomeImpl = vm
            .load(address(homeUpgrade(domain).beacon), bytes32(0))
            .bytes32ToAddress();
        assertEq(storedHomeImpl, address(homeImpl));

        // Verify Replica implementation
        string memory remote = getConnections(domain)[0];
        address storedReplicaImpl = vm
            .load(address(replicaOfUpgrade(domain, remote).beacon), bytes32(0))
            .bytes32ToAddress();
        assertEq(storedReplicaImpl, address(replicaImpl));

        // Verify Gov Router implementation
        address storedGovRouterImpl = vm
            .load(address(governanceRouterUpgrade(domain).beacon), bytes32(0))
            .bytes32ToAddress();
        assertEq(storedGovRouterImpl, address(govRouterImpl));

        // Verify Bridge Router implementation
        address storedBridgeRouterImpl = vm
            .load(address(bridgeRouterUpgrade(domain).beacon), bytes32(0))
            .bytes32ToAddress();
        assertEq(storedBridgeRouterImpl, address(bridgeRouterImpl));

        // Verify Bridge Token Implementation
        address storedBridgeTokenImpl = vm
            .load(address(bridgeTokenUpgrade(domain).beacon), bytes32(0))
            .bytes32ToAddress();
        assertEq(storedBridgeTokenImpl, address(bridgeTokenImpl));

        // Verify Bridge Token Implementation
        address storedTokenRegistryImpl = vm
            .load(address(tokenRegistryUpgrade(domain).beacon), bytes32(0))
            .bytes32ToAddress();
        assertEq(storedTokenRegistryImpl, address(tokenRegistryImpl));
    }

    /// @notice Read the governance actions that we created during the Reboot
    /// @dev The gov actions are expected to be stored in a JSON file of the form
    /// "<domain_name>.json" in "actions/"
    function readGovActions() internal returns (Batch memory) {
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
        // Not required for now, but useful to have
        // localActions = abi.decode(file.parseRaw(".local"), (Batch[]));
        // remoteActions = abi.decode(file.parseRaw(".remote"), (Batch[]));
    }

    /// @notice Execute the built governance actions in recovery mode
    function executeGovActions() internal {
        GovernanceRouter govRouter = getGovernanceRouter(domain);
        vm.prank(govRouter.recoveryManager());
        (bool _success, bytes memory _result) = address(govRouter).call(
            builtActions
        );
        assertTrue(_success);
    }
}
