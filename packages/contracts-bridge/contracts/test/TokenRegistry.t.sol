// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// Local imports
import {BridgeTest} from "./utils/BridgeTest.sol";
import {BridgeMessage} from "../BridgeMessage.sol";
import {BridgeToken} from "../BridgeToken.sol";
import {Encoding} from "../Encoding.sol";

// External imports
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenRegistryTest is BridgeTest {
    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using BridgeMessage for bytes29;

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

    function test_getCanonicalTokenIdNotTokenAddressReturnsZeroFuzzed(
        address noToken
    ) public {
        vm.assume(noToken != remoteTokenLocalAddress);
        (uint32 domain, bytes32 id) = tokenRegistry.getCanonicalTokenId(
            noToken
        );
        assertEq(uint256(domain), 0);
        assertEq(id, bytes32(0));
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

    function test_getRepresentationAddressWrongDetailsReturnZeroFuzzed(
        uint32 domain,
        bytes32 randomAddress
    ) public {
        vm.assume(
            randomAddress != remoteTokenRemoteAddress || domain != remoteDomain
        );
        address repr = tokenRegistry.getRepresentationAddress(
            domain,
            randomAddress
        );
        assertEq(repr, address(0));
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
        tokenRegistry.ensureLocalToken(remoteDomain, remoteTokenRemoteAddress);
    }

    uint256 iterations;

    function test_ensureLocalTokenDeployFuzzed(uint32 domain, bytes32 id)
        public
    {
        if (domain == localDomain) {
            vm.prank(tokenRegistry.owner());
            assertEq(
                tokenRegistry.ensureLocalToken(domain, id),
                TypeCasts.bytes32ToAddress(id)
            );
            return;
        }
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
        tokenRegistry.ensureLocalToken(remoteDomain, remoteTokenRemoteAddress);
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
        // Enroll first local custom token of a remote asset
        tokenRegistry.enrollCustom(domain, id, oldAddress);
        address newAddress = address(0xBEEFBEEF);
        vm.prank(tokenRegistry.owner());
        // After some time, the owner wants to enroll a  new implementation of the local custom token
        // for the same remote asset
        tokenRegistry.enrollCustom(domain, id, newAddress);
        // We make sure that a user can retrieve the new implementation of the remote asset, using the old
        // implementation as a key
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

    function test_getLocalAddressLocalAsset() public {
        assertEq(
            tokenRegistry.getLocalAddress(localDomain, address(localToken)),
            address(localToken)
        );
    }

    function test_getLocalAddressRemoteAssetRegistered() public {
        assertEq(
            tokenRegistry.getLocalAddress(
                remoteDomain,
                remoteTokenRemoteAddress
            ),
            remoteTokenLocalAddress
        );
    }

    function test_getLocalAddressRemoteAssetRegisteredFuzzed(
        uint32 newRemoteDomain,
        bytes32 newRemoteToken
    ) public {
        vm.assume(newRemoteDomain != localDomain && newRemoteDomain != 0);
        address local = createRemoteToken(newRemoteDomain, newRemoteToken);
        assertEq(
            tokenRegistry.getLocalAddress(newRemoteDomain, newRemoteToken),
            local
        );
    }

    function test_getLocalAddressRemoteAssetUnregistered() public {
        uint32 newRemoteDomain = 123;
        bytes32 newRemoteToken = "lol no";
        assertEq(
            tokenRegistry.getLocalAddress(newRemoteDomain, newRemoteToken),
            address(0)
        );
    }

    function test_getLocalAddressRemoteAssetUnregisteredFuzzed(
        uint32 newRemoteDomain,
        bytes32 newRemoteToken
    ) public {
        // we don't want to test against a known REGISTERED remote domain
        vm.assume(newRemoteDomain != localDomain && newRemoteDomain != 0);
        assertEq(
            tokenRegistry.getLocalAddress(newRemoteDomain, newRemoteToken),
            address(0)
        );
    }

    function test_getLocalAddressRemoteAssetRegisteredFail() public {
        // It will search for a remote token for domain `remoteDomain` and id `remoteTokenLocalAddress`
        // The correct id of the existing token is `remoteTokenRemoteAddress`
        assertEq(
            tokenRegistry.getLocalAddress(
                remoteDomain,
                remoteTokenLocalAddress
            ),
            address(0)
        );
    }

    function test_mustHaveLocalTokenRemoteToken() public view {
        require(
            tokenRegistry.mustHaveLocalToken(
                remoteDomain,
                remoteTokenRemoteAddress
            ) == IERC20(remoteTokenLocalAddress)
        );
    }

    function test_mustHaveLocalTokenRemoteTokenFuzzed(
        uint32 newRemoteDomain,
        bytes32 newRemoteToken
    ) public {
        vm.assume(
            newRemoteDomain != remoteDomain &&
                newRemoteDomain != localDomain &&
                newRemoteDomain != 0
        );
        address local = createRemoteToken(newRemoteDomain, newRemoteToken);
        require(
            tokenRegistry.mustHaveLocalToken(newRemoteDomain, newRemoteToken) ==
                IERC20(local)
        );
    }

    function test_mustHaveLocalTokenRemoteAssetUnregistered() public {
        uint32 newRemoteDomain = 123;
        bytes32 newRemoteToken = "lol no";
        vm.expectRevert("!token");
        tokenRegistry.mustHaveLocalToken(newRemoteDomain, newRemoteToken);
    }

    function test_mustHaveLocalTokenRemoteAssetUnregisteredFuzzed(
        uint32 newRemoteDomain,
        bytes32 newRemoteToken
    ) public {
        vm.assume(newRemoteDomain != localDomain && newRemoteDomain != 0);
        vm.expectRevert("!token");
        tokenRegistry.mustHaveLocalToken(newRemoteDomain, newRemoteToken);
    }

    function test_isLocalOriginLocaltoken() public view {
        assert(tokenRegistry.isLocalOrigin(address(localToken)));
    }

    function test_isLocalOriginRemoteToken() public {
        assertFalse(tokenRegistry.isLocalOrigin(remoteTokenLocalAddress));
    }

    function test_isLocalOriginRemoteTokenFuzzed(
        uint32 newRemoteDomain,
        bytes32 newRemoteToken
    ) public {
        vm.assume(
            newRemoteDomain != remoteDomain &&
                newRemoteDomain != localDomain &&
                newRemoteDomain != 0
        );
        address local = createRemoteToken(newRemoteDomain, newRemoteToken);
        assertFalse(tokenRegistry.isLocalOrigin(local));
    }

    function test_setRepresentationToCanonical() public {
        uint32 domain = 1;
        bytes32 id = "id";
        address repr = address(0xBEEF);
        (uint32 storedDomain, bytes32 storedId) = tokenRegistry
            .representationToCanonical(repr);
        assertEq(uint256(storedDomain), 0);
        assertEq(storedId, bytes32(0));
        tokenRegistry.exposed_setRepresentationToCanonical(domain, id, repr);
        (storedDomain, storedId) = tokenRegistry.representationToCanonical(
            repr
        );
        assertEq(uint256(storedDomain), domain);
        assertEq(storedId, id);
    }

    function test_setRepresentationToCanonicalFuzzed(
        uint32 domain,
        bytes32 id,
        address repr
    ) public {
        vm.assume(domain != localDomain && domain != 0);
        vm.assume(
            repr != address(localToken) && repr != remoteTokenLocalAddress
        );
        (uint32 storedDomain, bytes32 storedId) = tokenRegistry
            .representationToCanonical(repr);
        assertEq(uint256(storedDomain), 0);
        assertEq(storedId, bytes32(0));
        tokenRegistry.exposed_setRepresentationToCanonical(domain, id, repr);
        (storedDomain, storedId) = tokenRegistry.representationToCanonical(
            repr
        );
        assertEq(uint256(storedDomain), domain);
        assertEq(storedId, id);
    }

    function test_setCanonicalToRepresentation() public {
        uint32 domain = 1;
        bytes32 id = "id";
        address repr = address(0xBEEF);
        bytes29 tokenId = BridgeMessage.formatTokenId(domain, id);
        bytes32 tokenIdHash = tokenId.keccak();
        address storedRepr = tokenRegistry.canonicalToRepresentation(
            tokenIdHash
        );
        assertEq(storedRepr, address(0));
        tokenRegistry.exposed_setCanonicalToRepresentation(domain, id, repr);
        storedRepr = tokenRegistry.canonicalToRepresentation(tokenIdHash);
        assertEq(storedRepr, repr);
    }

    function test_setCanonicalToRepresentationFuzzed(
        uint32 domain,
        bytes32 id,
        address repr
    ) public {
        vm.assume(domain != localDomain && domain != 0);
        vm.assume(
            repr != address(localToken) && repr != remoteTokenLocalAddress
        );
        bytes29 tokenId = BridgeMessage.formatTokenId(domain, id);
        bytes32 tokenIdHash = tokenId.keccak();
        address storedRepr = tokenRegistry.canonicalToRepresentation(
            tokenIdHash
        );
        assertEq(storedRepr, address(0));
        tokenRegistry.exposed_setCanonicalToRepresentation(domain, id, repr);
        storedRepr = tokenRegistry.canonicalToRepresentation(tokenIdHash);
        assertEq(storedRepr, repr);
    }

    // We can reuse the storage variable `iterations` because all tests run against the SAME state that is created
    // by `setUp()`. Thus, the variable is set to 0 and then it's incremented in different states for every test, in
    // isolation.
    function test_exposedDeployToken() public {
        uint32 domain = 99999;
        bytes32 id = "It's over 9000";
        address repr = tokenRegistry.getRepresentationAddress(domain, id);
        assertEq(repr, address(0));
        address calculated = computeCreateAddress(
            address(tokenRegistry),
            2 + iterations
        );
        // test event emmission
        vm.expectEmit(true, true, true, false);
        emit TokenDeployed(domain, id, calculated);
        address tokenAddress = tokenRegistry.exposed_deployToken(domain, id);
        BridgeToken token = BridgeToken(tokenAddress);
        repr = tokenRegistry.getRepresentationAddress(domain, id);
        (uint32 storedDomain, bytes32 storedId) = tokenRegistry
            .getCanonicalTokenId(tokenAddress);
        // test mappings
        assertEq(repr, tokenAddress);
        assertEq(uint256(storedDomain), domain);
        assertEq(storedId, id);
        // test is initialized
        assertEq(token.owner(), address(bridgeRouter));
        (string memory name, string memory symbol) = tokenRegistry
            .exposed_defaultDetails(domain, id);
        // test if default name and symbol is set
        assertEq(token.name(), name);
        assertEq(token.symbol(), symbol);
        iterations++;
    }

    function test_deployTokenFuzzed(uint32 domain, bytes32 id) public {
        vm.assume(domain != localDomain && domain != 0);
        address repr = tokenRegistry.getRepresentationAddress(domain, id);
        assertEq(repr, address(0));
        address calculated = computeCreateAddress(
            address(tokenRegistry),
            2 + iterations
        );
        // test event emmission
        vm.expectEmit(true, true, true, false);
        emit TokenDeployed(domain, id, calculated);
        address tokenAddress = tokenRegistry.exposed_deployToken(domain, id);
        BridgeToken token = BridgeToken(tokenAddress);
        repr = tokenRegistry.getRepresentationAddress(domain, id);
        (uint32 storedDomain, bytes32 storedId) = tokenRegistry
            .getCanonicalTokenId(tokenAddress);
        // test mappings
        assertEq(repr, tokenAddress);
        assertEq(uint256(storedDomain), domain);
        assertEq(storedId, id);
        // test is initialized
        assertEq(token.owner(), address(bridgeRouter));
        (string memory name, string memory symbol) = tokenRegistry
            .exposed_defaultDetails(domain, id);
        // test if default name and symbol is set
        assertEq(token.name(), name);
        assertEq(token.symbol(), symbol);
        iterations++;
    }

    function test_defaultDetails() public {
        uint32 domain = 1;
        bytes32 id = "test";
        (, uint256 secondHalfId) = Encoding.encodeHex(uint256(id));
        string memory name = string(
            abi.encodePacked(
                Encoding.decimalUint32(domain), // 10
                ".", // 1
                uint32(secondHalfId) // 4
            )
        );
        string memory symbol = new string(10 + 1 + 4);
        assembly {
            mstore(add(symbol, 0x20), mload(add(name, 0x20)))
        }
        (string memory storedName, string memory storedSymbol) = tokenRegistry
            .exposed_defaultDetails(domain, id);
        assertEq(storedName, name);
        assertEq(storedSymbol, symbol);
    }

    function test_defaultDetailsFuzzed(uint32 domain, bytes32 id) public {
        vm.assume(domain != localDomain && domain != 0);
        (, uint256 secondHalfId) = Encoding.encodeHex(uint256(id));
        string memory name = string(
            abi.encodePacked(
                Encoding.decimalUint32(domain), // 10
                ".", // 1
                uint32(secondHalfId) // 4
            )
        );
        string memory symbol = new string(10 + 1 + 4);
        assembly {
            mstore(add(symbol, 0x20), mload(add(name, 0x20)))
        }
        (string memory storedName, string memory storedSymbol) = tokenRegistry
            .exposed_defaultDetails(domain, id);
        assertEq(storedName, name);
        assertEq(storedSymbol, symbol);
    }

    function test_localDomain() public {
        assertEq(tokenRegistry.exposed_localDomain(), uint256(localDomain));
    }

    // Test that renounceOwnership is a noop
    function test_renounceOwnership() public {
        vm.startPrank(tokenRegistry.owner());
        tokenRegistry.renounceOwnership();
        uint256 gasAfter = gasleft();
        // hardcode the gas that is consumed from calling an empty function
        // any change to the function will cause this test to fail
        assertEq(gasAfter, 9223372036854743394);
    }
}
