// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Script.sol";
import {Config} from "../Config.sol";

import {AllowListNFTRecoveryAccountant} from "@nomad-xyz/contracts-bridge/contracts/accountants/NFTAccountant.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconProxy} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconProxy.sol";

contract DeployAccountant is Script, Config {
    // entrypoint
    function deploy(string calldata configFile, string calldata domain) public {
        __Config_initialize(configFile);
        deployAccountant(domain);
    }

    // Deploys & configures the NFTAccountant with upgrade setup
    function deployAccountant(string calldata domain) internal {
        address fundsRecipient = vm.addr(567); // TODO
        address accountantOwner = vm.addr(89); // TODO
        // deploy implementation
        AllowListNFTRecoveryAccountant implementation = new AllowListNFTRecoveryAccountant(
                address(bridgeRouter(domain)),
                fundsRecipient
            );
        // initialize implementation
        implementation.initialize();
        // deploy UpgradeBeacon (with UpgradeBeaconController as owner)
        UpgradeBeacon beacon = new UpgradeBeacon(
            address(implementation),
            address(upgradeBeaconController(domain))
        );
        // deploy UpgradeBeaconProxy
        UpgradeBeaconProxy proxy = new UpgradeBeaconProxy(
            address(beacon),
            "0x"
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
}
