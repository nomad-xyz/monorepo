// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {NomadCore} from "./utils/NomadCore.sol";
import "forge-std/console2.sol";

/// @notice Example of setting up 2 domains and connecting them with a
/// bidirectional channel.
contract NomadCoreLocalTest is NomadCore {
    function setUp() public override {
        super.setUp();
        for (uint256 i = 0; i < domains.length; i++) {
            uint32 domain1 = domains[i];
            // Create core protocol on Domain 1
            createCore(domain1);
            // For every other domain, create a replica on Domain 1
            for (uint256 j = 0; j < domains.length; j++) {
                uint32 domain2 = domains[j];
                // We shouldn't create a replica for itself
                if (domain2 != domain1) {
                    createLocalReplicaForRemoteDomain(domain1, domain2);
                }
            }
            // Relinquish control of the protocol on Domain 1 to Nomad Protocol
            relinquishCoreControl(domain1);
            printDomainContracts(domain1);
        }
        // Set domain 1 as the Governor domain
        console2.log("Nomad Core is deployed!");
    }

    /// @notice Example test to showcase NomadCore fixture
    /// Remove `example` for it to run automatically with forge test
    function example_test_home() public {
        assertEq(home.updater(), updater);
    }
}

/// @notice Example of setting up 2 domains and connecting them with a
/// bidirectional channel, but using real state from Ethereum and Polygon.
/// All tests will run against the deployed protocol on the two different forks,
/// with the user being able to freely change between the two and make powerful assertions.
contract NomadCoreForkTest is NomadCore {
    uint256 ethFork;
    uint256 polFork;

    uint32 ethDomain;
    uint32 polDomain;

    function setUp() public override {
        super.setUp();
        // Create fork states
        // RPC endpoints supplied from: https://rpc.info/
        ethFork = vm.createFork(
            "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"
        );
        polFork = vm.createFork("https://polygon-rpc.com");
        // Use default domains
        // locaDomain
        ethDomain = domains[0];
        // remoteDomain
        polDomain = domains[1];

        // localDomain = domains[0];
        // remoteDomain = domains[1];
        vm.selectFork(ethFork);
        createCore(ethDomain);
        createLocalReplicaForRemoteDomain(ethDomain, polDomain);
        relinquishCoreControl(ethDomain);
        printDomainContracts(ethDomain);

        vm.selectFork(polFork);
        createCore(polDomain);
        createLocalReplicaForRemoteDomain(polDomain, ethDomain);
        relinquishCoreControl(polDomain);
        printDomainContracts(polDomain);

        // Set Ethereum as the Governor domain
        console2.log("Nomad Core is deployed to Ethereum and Polygon forks!");
    }

    /// @notice Example test to showcase forking in NomadCore fixture
    /// Remove `example` for it to run automatically with forge test
    function example_test_eth_home() public {
        vm.selectFork(ethFork);
        home = homes[domainToIndex[ethDomain]];
        assertEq(home.updater(), updater);

        home = homes[domainToIndex[polDomain]];
        // We expect a revert because the address points to `home` in Polygon, not Ethereum
        vm.expectRevert();
        home.updater();
    }
}
