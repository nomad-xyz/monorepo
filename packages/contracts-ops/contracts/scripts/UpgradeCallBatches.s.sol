// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
    //////////////////////////////////////////////////////////////*/

// Utilities
import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";

// Ops libs
import {Config} from "../../contracts/Config.sol";
import {CallBatch} from "../../contracts/Callbatch.sol";

contract UpgradeCallBatches is Test, Config, CallBatch {
    /*//////////////////////////////////////////////////////////////
                                 BEACONS
    //////////////////////////////////////////////////////////////*/

    address homeBeacon;
    address replicaBeacon;
    address governanceRouterBeacon;
    address bridgeRouterBeacon;
    address tokenRegistryBeacon;
    address bridgeTokenBeacon;

    /*//////////////////////////////////////////////////////////////
                             IMPLEMENTATIONS
    //////////////////////////////////////////////////////////////*/

    address homeImpl;
    address replicaImpl;
    address governanceRouterImpl;
    address bridgeTokenImpl;
    address tokenRegistryImpl;
    address bridgeRouterImpl;

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
    address governanceRouterProxy;

    bytes executeCallBatchCall;

    string configFile;
    string[] remoteDomainNames;
    string[] networksArray;

    function run(
        string memory _configFile,
        string[] memory _remoteDomainNames,
        string memory _localDomainName,
        bool recovery
    ) external {
        localDomainName = _localDomainName;
        remoteDomainNames = _remoteDomainNames;
        configFile = _configFile;
        setUp();
        for (uint256 i; i < remoteDomainNames.length; i++) {
            string memory domain = remoteDomainNames[i];
            loadBeacons(domain);
            loadImplementations(domain);
            loadController(domain);
            generateGovernanceCalls(domain);
        }
        writeCallBatch(recovery);
    }

    function setUp() internal {
        __Config_initialize(configFile);
        string memory outputFile = "upgradeActions.json";
        __CallBatch_initialize(
            localDomainName,
            getDomainNumber(localDomainName),
            outputFile,
            true
        );
        networksArray = getNetworks();
    }

    function loadBeacons(string memory domain) internal {
        bridgeTokenBeacon = address(bridgeTokenUpgrade(domain).beacon);
        tokenRegistryBeacon = address(tokenRegistryUpgrade(domain).beacon);
        bridgeRouterBeacon = address(bridgeRouterUpgrade(domain).beacon);
        governanceRouterBeacon = address(
            governanceRouterUpgrade(domain).beacon
        );
        governanceRouterProxy = address(governanceRouterUpgrade(domain).proxy);
        for (uint256 i; i < networksArray.length; i++) {
            if (!compareStrings(networksArray[i], domain)) {
                replicaBeacon = address(
                    replicaOfUpgrade(domain, networksArray[i]).beacon
                );
                break;
            }
            homeImpl = address(homeUpgrade(domain).beacon);
        }
        homeBeacon = address(homeUpgrade(domain).beacon);
    }

    function loadImplementations(string memory domain) internal {
        bridgeTokenImpl = bridgeTokenUpgrade(domain).implementation;
        tokenRegistryImpl = tokenRegistryUpgrade(domain).implementation;
        bridgeRouterImpl = bridgeRouterUpgrade(domain).implementation;
        governanceRouterImpl = governanceRouterUpgrade(domain).implementation;
        // All replicas have the same implmentation
        for (uint256 i; i < networksArray.length; i++) {
            if (!compareStrings(networksArray[i], domain)) {
                replicaImpl = replicaOfUpgrade(domain, networksArray[i])
                    .implementation;
                break;
            }
            homeImpl = homeUpgrade(domain).implementation;
        }
    }

    function loadController(string memory domain) internal {
        beaconController = address(getUpgradeBeaconController(domain));
    }

    /*//////////////////////////////////////////////////////////////
                       GOVERNANCE CALL GENERATORS
    //////////////////////////////////////////////////////////////*/

    function generateGovernanceCalls(string memory domain) internal {
        title("BeaconController upgrade encoded calls for", domain);
        console2.log(
            "Domain Number: ",
            vm.toString(uint256(getDomainNumber(domain)))
        );
        console2.log("Function signature: upgrade(address, address)");
        console2.log(
            "Arguments: <contract_beacon>, <new_implementation_address>"
        );

        upgradeHome = abi.encodeWithSignature(
            "upgrade(address,address)",
            homeBeacon,
            homeImpl
        );
        console2.log("Upgrade Home");
        console2.logBytes(upgradeHome);

        upgradeReplica = abi.encodeWithSignature(
            "upgrade(address,address)",
            replicaBeacon,
            replicaImpl
        );
        console2.log("Upgrade Replica");
        console2.logBytes(upgradeReplica);
        upgradeGovRouter = abi.encodeWithSignature(
            "upgrade(address,address)",
            governanceRouterBeacon,
            governanceRouterImpl
        );
        console2.log("Upgrade Governance Router");
        console2.logBytes(upgradeGovRouter);

        upgradeBridgeRouter = abi.encodeWithSignature(
            "upgrade(address,address)",
            bridgeRouterBeacon,
            bridgeRouterImpl
        );
        console2.log("Upgrade Bridge Router");
        console2.logBytes(upgradeBridgeRouter);

        upgradeTokenRegistry = abi.encodeWithSignature(
            "upgrade(address,address)",
            tokenRegistryBeacon,
            tokenRegistryImpl
        );
        console2.log("Upgrade Token Registry");
        console2.logBytes(upgradeTokenRegistry);

        upgradeBridgeToken = abi.encodeWithSignature(
            "upgrade(address,address)",
            bridgeTokenBeacon,
            bridgeTokenImpl
        );
        console2.log("Upgrade Bridge Token");
        console2.logBytes(upgradeBridgeToken);
        if (compareStrings(domain, localDomainName)) {
            pushLocal(beaconController, upgradeBridgeToken);
            pushLocal(beaconController, upgradeTokenRegistry);
            pushLocal(beaconController, upgradeBridgeRouter);
            pushLocal(beaconController, upgradeGovRouter);
            pushLocal(beaconController, upgradeReplica);
            pushLocal(beaconController, upgradeHome);
        } else {
            uint32 domainNumber = getDomainNumber(domain);
            pushRemote(beaconController, upgradeBridgeToken, domainNumber);
            pushRemote(beaconController, upgradeTokenRegistry, domainNumber);
            pushRemote(beaconController, upgradeBridgeRouter, domainNumber);
            pushRemote(beaconController, upgradeGovRouter, domainNumber);
            pushRemote(beaconController, upgradeReplica, domainNumber);
            pushRemote(beaconController, upgradeHome, domainNumber);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                UTILITIES
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

    function compareStrings(string memory a, string memory b)
        internal
        returns (bool)
    {
        return (keccak256(abi.encodePacked(a)) ==
            keccak256(abi.encodePacked(b)));
    }
}
