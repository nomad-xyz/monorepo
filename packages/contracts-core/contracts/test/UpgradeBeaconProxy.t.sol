// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

// Test libraries

import {UpgradeTest} from "./utils/UpgradeTest.sol";
import {MockBeacon} from "./utils/MockBeacon.sol";
import {MockBeaconRevert} from "./utils/MockBeaconRevert.sol";
import {MockBeaconNotAddr} from "./utils/MockBeaconNotAddr.sol";
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
        emit Quote("The fires are lit! The fires of Amon Din are lit");
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

    function test_constructorBeaconNotContract() public {
        beaconAddr = address(0xBEEF);
        vm.expectRevert("beacon !contract");
        proxy = new UpgradeBeaconProxy(
            beaconAddr,
            abi.encodeWithSignature("gondor()")
        );
    }

    function test_constructorBeaconNotContractFuzzed(address _beaconAddr)
        public
    {
        vm.assume(!isContract(_beaconAddr));
        vm.expectRevert("beacon !contract");
        proxy = new UpgradeBeaconProxy(
            _beaconAddr,
            abi.encodeWithSignature("gondor()")
        );
    }

    function test_constructorImplNotcontract() public {
        implAddr = address(0xBEEF);
        mockBeacon = new MockBeacon(implAddr, controllerAddr);
        beaconAddr = address(mockBeacon);
        vm.expectRevert("beacon implementation !contract");
        proxy = new UpgradeBeaconProxy(
            beaconAddr,
            abi.encodeWithSignature("gondor()")
        );
    }

    function test_constructorImplNotcontractFuzzed(address _implAddr) public {
        mockBeacon = new MockBeacon(_implAddr, controllerAddr);
        beaconAddr = address(mockBeacon);
        vm.assume(!isContract(_implAddr));
        vm.expectRevert("beacon implementation !contract");
        proxy = new UpgradeBeaconProxy(
            beaconAddr,
            abi.encodeWithSignature("gondor()")
        );
    }

    function test_fallback() public {
        vm.expectEmit(false, false, false, true);
        emit Quote("I am no man");
        proxyAddr.call(abi.encodeWithSignature("witchKing(bool)", true));
    }

    function test_fallbackRevert() public {
        vm.expectRevert("no man can kill me");
        proxyAddr.call(abi.encodeWithSignature("witchKing(bool)", false));
    }

    function test_receive() public {
        // Give 10 ether
        vm.deal(address(this), 10);
        // Empty calldata + value invokes the receive() function
        emit Quote(
            "Nine were given to the kings of men whose heart above all desire Power"
        );
        proxyAddr.call{value: 1}("");
    }

    // Test that if beacon reverts during `_getImplementation`, proxy will return the
    // revert error
    function test_getImplementationRevert() public {
        MockBeaconRevert mockBeaconRevert = new MockBeaconRevert(
            implAddr,
            controllerAddr
        );
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "lol no"));
        proxy = new UpgradeBeaconProxy(address(mockBeaconRevert), "");
    }

    // Test that if beacon returns raw bytes that aren't an address
    function test_getImplementationNotAddress() public {
        MockBeaconNotAddr mockBeaconNotAddr = new MockBeaconNotAddr(
            implAddr,
            controllerAddr
        );
        vm.expectRevert("beacon implementation !contract");
        proxy = new UpgradeBeaconProxy(address(mockBeaconNotAddr), "");
    }
}
