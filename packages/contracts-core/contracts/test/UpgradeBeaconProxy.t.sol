// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

// Test libraries

import {UpgradeTest} from "./utils/UpgradeTest.sol";
import {MockBeacon} from "./utils/MockBeacon.sol";
import {UpgradeBeaconProxy} from "../upgrade/UpgradeBeaconProxy.sol";

contract UpgradeProxyTest is UpgradeTest {
    MockBeacon mockBeacon;
    UpgradeBeaconProxy proxy;

    event Quote(string what);

    function setUp() public override {
        super.setUp();
        controllerAddr = address(this);
        mockBeacon = new MockBeacon(implAddr, controllerAddr);
        beaconAddr = address(mockBeacon);
        vm.expectEmit(false, false, false, true);
        emit Quote("The fires are lit! The fires of Amon din are lit");
        proxy = new UpgradeBeaconProxy(
            beaconAddr,
            abi.encodeWithSignature("gondor()")
        );
        proxyAddr = address(proxy);
    }

    function test_constructor() public {
        (bool success, bytes memory data) = proxyAddr.call(
            abi.encodeWithSignature("fires()")
        );
        assert(success);
        assert(abi.decode(data, (bool)));
    }
}
