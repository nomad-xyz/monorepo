// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Script.sol";
import {Config} from "../Config.sol";
import {JsonWriter} from "../JsonWriter.sol";

import {AllowListNFTRecoveryAccountant} from "@nomad-xyz/contracts-bridge/contracts/accountants/NFTAccountant.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconProxy} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconProxy.sol";

abstract contract DeployAccountantLogic is Script, Config {
    AllowListNFTRecoveryAccountant implementation;
    UpgradeBeacon beacon;
    UpgradeBeaconProxy proxy;

    // Deploys & configures the NFTAccountant with upgrade setup
    function deployAccountant(string memory _domain) internal {
        // deploy implementation
        implementation = new AllowListNFTRecoveryAccountant(
            address(getBridgeRouter(_domain)),
            getFundsRecipient(_domain)
        );
        // initialize implementation
        implementation.initialize();
        // deploy UpgradeBeacon (with UpgradeBeaconController as owner)
        beacon = new UpgradeBeacon(
            address(implementation),
            address(getUpgradeBeaconController(_domain))
        );
        // deploy UpgradeBeaconProxy
        proxy = new UpgradeBeaconProxy(address(beacon), "");
        // initialize proxy
        // Note: this is necessary to perform separately from the Proxy deployment
        //       because the initialize function has no parameters
        //       so `initialize` will not be called automatically on deployment
        AllowListNFTRecoveryAccountant(address(proxy)).initialize();
        // transfer ownership of proxy
        AllowListNFTRecoveryAccountant(address(proxy)).transferOwnership(
            getAccountantOwner(_domain)
        );
    }
}

abstract contract DeployAccountant is DeployAccountantLogic {
    using JsonWriter for JsonWriter.Buffer;
    using JsonWriter for string;

    JsonWriter.File outputFile;

    // entrypoint
    function deploy(
        string calldata _configFile,
        string memory _domain,
        string memory _outputFile,
        bool _overwrite
    ) public {
        // initialize
        __Config_initialize(_configFile);
        _outputFile = string(abi.encodePacked("./actions/", _outputFile));
        outputFile.path = _outputFile;
        outputFile.overwrite = _overwrite;
        // deploy & configure accountant
        vm.startBroadcast();
        deployAccountant(_domain);
        vm.stopBroadcast();
        // write contract addresses to JSON
        write();
    }

    function write() internal {
        JsonWriter.Buffer memory buffer = JsonWriter.newBuffer();
        string memory indent = "";
        string[2][] memory kvs = new string[2][](3);
        kvs[0][0] = "implementation";
        kvs[0][1] = vm.toString(address(implementation));
        kvs[1][0] = "beacon";
        kvs[1][1] = vm.toString(address(beacon));
        kvs[2][0] = "proxy";
        kvs[2][1] = vm.toString(address(proxy));
        buffer.writeSimpleObject(indent, "accountant", kvs, true);
        buffer.flushTo(outputFile);
    }
}
