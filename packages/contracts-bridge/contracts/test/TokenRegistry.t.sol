// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {BridgeTest} from "./utils/BridgeTest.sol";

import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

contract TokenRegistryTest is BridgeTest {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    function setUp() public override {
        super.setUp();
    }

    function test_getCanonicalTokenId() public {
        (uint32 domain, bytes32 id) = tokenRegistry.getCanonicalTokenId(
            remoteTokenLocalAddress
        );
        assertEq(uint256(domain), remoteDomain);
        assertEq(id, remoteTokenRemoteAddress);
    }

    function test_getCanonicalTokenIdFuzzed(
        uint32 fuzzedDomain,
        bytes32 fuzzedId
    ) public {
        vm.assume(fuzzedDomain != 0 && fuzzedId != bytes32(0));
        address localAddress = createRemoteToken(fuzzedDomain, fuzzedId);
        (uint32 domain, bytes32 id) = tokenRegistry.getCanonicalTokenId(
            localAddress
        );
        assertEq(uint256(domain), fuzzedDomain);
        assertEq(id, fuzzedId);
    }

    function test_getRepresentationAddress() public {
        address repr = tokenRegistry.getRepresentationAddress(
            remoteDomain,
            remoteTokenRemoteAddress
        );
        assertEq(repr, remoteTokenLocalAddress);
    }

    function test_getRepresentationAddressFuzzed(
        uint32 fuzzedDomain,
        bytes32 fuzzedId
    ) public {
        vm.assume(fuzzedDomain != 0 && fuzzedId != bytes32(0));
        address localAddress = createRemoteToken(fuzzedDomain, fuzzedId);
        address repr = tokenRegistry.getRepresentationAddress(
            fuzzedDomain,
            fuzzedId
        );
        assertEq(repr, localAddress);
    }

    event TokenDeployed(
        uint32 indexed domain,
        bytes32 indexed id,
        address indexed representation
    );

    function test_ensureLocalTokenDeploy() public {
        uint32 newDomain = 13;
        bytes32 newId = bytes32("hey yoou");
        // It's the second contract that is been deployed by tokenRegistry
        // It deploys a bridgeToken during setUp() of BridgeTest
        address calculated = computeCreateAddress(address(tokenRegistry), 2);
        vm.expectEmit(true, true, true, false);
        emit TokenDeployed(newDomain, newId, calculated);
        vm.prank(tokenRegistry.owner());
        address deployed = tokenRegistry.ensureLocalToken(newDomain, newId);
        assertEq(deployed, calculated);
    }

    function test_ensureLocalTokenExisting() public {
        // It's the second contract that is been deployed by tokenRegistry
        // It deploys a bridgeToken during setUp() of BridgeTest
        vm.prank(tokenRegistry.owner());
        address addr = tokenRegistry.ensureLocalToken(
            remoteDomain,
            remoteTokenRemoteAddress
        );
        assertEq(addr, remoteTokenLocalAddress);
    }

    function test_ensureLocalTokenOnlyOwner() public {
        // It's the second contract that is been deployed by tokenRegistry
        // It deploys a bridgeToken during setUp() of BridgeTest
        vm.expectRevert("Ownable: caller is not the owner");
        address addr = tokenRegistry.ensureLocalToken(
            remoteDomain,
            remoteTokenRemoteAddress
        );
    }

    uint256 iterations;

    function test_ensureLocalTokenDeployFuzzed(uint32 domain, bytes32 id)
        public
    {
        // It's the second contract that is been deployed by tokenRegistry
        // It deploys a bridgeToken during setUp() of BridgeTest
        address calculated = computeCreateAddress(
            address(tokenRegistry),
            2 + iterations
        );
        vm.expectEmit(true, true, true, false);
        emit TokenDeployed(domain, id, calculated);
        vm.prank(tokenRegistry.owner());
        address deployed = tokenRegistry.ensureLocalToken(domain, id);
        assertEq(deployed, calculated);
        iterations++;
    }

    function test_ensureLocalTokenOnlyOwnerFuzzed(address user) public {
        // It's the second contract that is been deployed by tokenRegistry
        // It deploys a bridgeToken during setUp() of BridgeTest
        vm.assume(user != tokenRegistry.owner());
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(user);
        address addr = tokenRegistry.ensureLocalToken(
            remoteDomain,
            remoteTokenRemoteAddress
        );
    }

    function test_enrollCustom() public {
        uint32 newDomain = 24;
        bytes32 newId = "yaw";
        address customAddress = address(0xBEEF);
        vm.prank(tokenRegistry.owner());
        tokenRegistry.enrollCustom(newDomain, newId, customAddress);
        (uint32 storedDomain, bytes32 storedId) = tokenRegistry
            .getCanonicalTokenId(customAddress);
        address storedAddress = tokenRegistry.getRepresentationAddress(
            newDomain,
            newId
        );
        assertEq(uint256(storedDomain), uint256(newDomain));
        assertEq(storedId, newId);
        assertEq(storedAddress, customAddress);
    }

    function test_enrollCustomOnlyOwner() public {
        uint32 newDomain = 24;
        bytes32 newId = "yaw";
        address customAddress = address(0xBEEF);
        vm.expectRevert("Ownable: caller is not the owner");
        tokenRegistry.enrollCustom(newDomain, newId, customAddress);
    }

    function test_enrollCustomFuzzed(
        uint32 dom,
        bytes32 id,
        address addr
    ) public {
        vm.prank(tokenRegistry.owner());
        tokenRegistry.enrollCustom(dom, id, addr);
        (uint32 storedDomain, bytes32 storedId) = tokenRegistry
            .getCanonicalTokenId(addr);
        address storedAddress = tokenRegistry.getRepresentationAddress(dom, id);
        assertEq(uint256(storedDomain), uint256(dom));
        assertEq(storedId, id);
        assertEq(storedAddress, addr);
    }

    function test_oldReprToCurrentRepr() public {
        uint32 domain = 24;
        bytes32 id = "yaw";
        address oldAddress = address(0xBEEF);
        vm.prank(tokenRegistry.owner());
        tokenRegistry.enrollCustom(domain, id, oldAddress);
        address newAddress = address(0xBEEFBEEF);
        vm.prank(tokenRegistry.owner());
        tokenRegistry.enrollCustom(domain, id, newAddress);
        assertEq(tokenRegistry.oldReprToCurrentRepr(oldAddress), newAddress);
    }

    function test_oldReprToCurrentReprFuzzed(
        address oldAddress,
        address newAddress,
        uint32 domain,
        bytes32 id
    ) public {
        vm.assume(domain != 0);
        vm.prank(tokenRegistry.owner());
        tokenRegistry.enrollCustom(domain, id, oldAddress);
        vm.prank(tokenRegistry.owner());
        tokenRegistry.enrollCustom(domain, id, newAddress);
        assertEq(tokenRegistry.oldReprToCurrentRepr(oldAddress), newAddress);
    }

    function test_getTokenIdCanonical() public {
        (uint32 domain, bytes32 id) = tokenRegistry.getTokenId(
            address(localToken)
        );
        assertEq(uint256(domain), localDomain);
        assertEq(id, TypeCasts.addressToBytes32(address(localToken)));
    }

    function test_getTokenIdRepr() public {
        (uint32 domain, bytes32 id) = tokenRegistry.getTokenId(
            address(remoteTokenLocalAddress)
        );
        assertEq(uint256(domain), remoteDomain);
        assertEq(id, remoteTokenRemoteAddress);
    }

    function test_getTokenIdRerprFuzzed(uint32 dom, bytes32 id) public {
        // Domain can be 0?
        vm.assume(dom != localDomain && dom != 0);
        vm.assume(id != remoteTokenRemoteAddress && id != bytes32(0));
        address loc = createRemoteToken(dom, id);
        (uint32 storedDomain, bytes32 storedId) = tokenRegistry.getTokenId(loc);
        assertEq(uint256(storedDomain), dom);
        assertEq(storedId, id);
    }
}
