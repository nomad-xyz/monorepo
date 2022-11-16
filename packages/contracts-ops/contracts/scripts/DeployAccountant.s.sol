// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {Script, console2} from "forge-std/Script.sol";
import {Config} from "../Config.sol";

import {AllowListNFTRecoveryAccountant} from "@nomad-xyz/contracts-bridge/contracts/accountants/NFTAccountant.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconProxy} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconProxy.sol";

abstract contract DeployAccountantLogic is Script, Config {
    AllowListNFTRecoveryAccountant implementation;
    UpgradeBeacon beacon;
    UpgradeBeaconProxy proxy;

    // Deploys & configures the NFTAccountant with upgrade setup
    function deployAccountant(string memory _domain) internal {
        // if accountant was already deployed, don't deploy
        if (address(getAccountant(_domain)) != address(0)) return;
        console2.log("deploy accountant ", _domain);
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

    function writeAccountantConfig(string memory _domain) internal {
        // if accountant was not deployed, don't write
        if (address(proxy) == address(0)) return;
        vm.writeJson(
            vm.toString(address(beacon)),
            configPath,
            bridgeAttributePath(_domain, "accountant.beacon")
        );
        vm.writeJson(
            vm.toString(address(implementation)),
            configPath,
            bridgeAttributePath(_domain, "accountant.implementation")
        );
        vm.writeJson(
            vm.toString(address(proxy)),
            configPath,
            bridgeAttributePath(_domain, "accountant.proxy")
        );
        reloadConfig();
    }
}

contract DeployAccountant is DeployAccountantLogic {
    // entrypoint
    function deploy(string calldata _configFile, string memory _domain) public {
        // initialize
        __Config_initialize(_configFile);
        // deploy & configure accountant
        vm.startBroadcast();
        deployAccountant(_domain);
        vm.stopBroadcast();
        // write contract addresses to JSON
        writeAccountantConfig(_domain);
    }
}
