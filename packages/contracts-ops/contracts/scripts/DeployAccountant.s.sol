// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Script.sol";
import {Config} from "../Config.sol";
import {JsonWriter} from "../JsonWriter.sol";

import {AllowListNFTRecoveryAccountant} from "@nomad-xyz/contracts-bridge/contracts/accountants/NFTAccountant.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconProxy} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconProxy.sol";

abstract contract DeployAccountantLogic is Config {
    using JsonWriter for JsonWriter.Buffer;
    using JsonWriter for string;

    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    AllowListNFTRecoveryAccountant implementation;
    UpgradeBeacon beacon;
    UpgradeBeaconProxy proxy;

    // Deploys & configures the NFTAccountant with upgrade setup
    function deployAccountant(string memory _domain) internal {
        address fundsRecipient = vm.addr(567); // TODO
        address accountantOwner = vm.addr(89); // TODO
        // deploy implementation
        implementation = new AllowListNFTRecoveryAccountant(
                address(bridgeRouter(_domain)),
                fundsRecipient
            );
        // initialize implementation
        implementation.initialize();
        // deploy UpgradeBeacon (with UpgradeBeaconController as owner)
        beacon = new UpgradeBeacon(
            address(implementation),
            address(upgradeBeaconController(_domain))
        );
        // deploy UpgradeBeaconProxy
        proxy = new UpgradeBeaconProxy(
            address(beacon),
            ""
        );
        // initialize proxy
        // Note: this is necessary to perform separately from the Proxy deployment
        //       because the initialize function has no parameters
        //       so `initialize` will not be called automatically on deployment
        AllowListNFTRecoveryAccountant(address(proxy)).initialize();
        // transfer ownership of proxy
        AllowListNFTRecoveryAccountant(address(proxy)).transferOwnership(
            accountantOwner
        );
    }

    function write(JsonWriter.File memory outputFile) internal {
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


contract DeployAccountant is Script, DeployAccountantLogic {
    JsonWriter.File deployAccountantOutput;

    // entrypoint
    function deploy(string calldata _configFile, string memory _domain, string memory _deployAccountantOutput, bool _overwrite) public {
        // initialize
        __Config_initialize(_configFile);
        _deployAccountantOutput = string(abi.encodePacked("./actions/", _deployAccountantOutput));
        deployAccountantOutput.path = _deployAccountantOutput;
        deployAccountantOutput.overwrite = _overwrite;
        // deploy & configure accountant
        vm.startBroadcast();
        deployAccountant(_domain);
        vm.stopBroadcast();
        // write contract addresses to JSON
        write(deployAccountantOutput);
    }
}