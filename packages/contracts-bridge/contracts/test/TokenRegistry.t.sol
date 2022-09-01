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
}
