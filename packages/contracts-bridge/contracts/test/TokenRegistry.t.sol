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
}
