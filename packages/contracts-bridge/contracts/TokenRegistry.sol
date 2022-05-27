// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// ============ Local Contracts ============
import {BridgeMessage} from "./BridgeMessage.sol";
import {Encoding} from "./Encoding.sol";
// ============ Interfaces ============
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBridgeToken} from "./interfaces/IBridgeToken.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";
// ============ External Contracts ============
import {XAppConnectionClient} from "@nomad-xyz/contracts-router/contracts/XAppConnectionClient.sol";
import {TypeCasts} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {UpgradeBeaconProxy} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconProxy.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

/**
 * @title TokenRegistry
 * @notice manages a registry of token contracts on this chain
 * -
 * We sort token types as "representation token" or "locally originating token".
 * Locally originating - a token contract that was originally deployed on the local chain
 * Representation (repr) - a token that was originally deployed on some other chain
 * -
 * When the BridgeRouter handles an incoming message, it determines whether the
 * transfer is for an asset of local origin. If not, it checks for an existing
 * representation contract. If no such representation exists, it deploys a new
 * representation contract. It then stores the relationship in the
 * "reprToCanonical" and "canonicalToRepr" mappings to ensure we can always
 * perform a lookup in either direction
 * Note that locally originating tokens should NEVER be represented in these lookup tables.
 */
contract TokenRegistry is Initializable, XAppConnectionClient, ITokenRegistry {
    // ============ Libraries ============

    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using BridgeMessage for bytes29;

    // ============ Public Storage ============

    // UpgradeBeacon from which new token proxies will get their implementation
    address public tokenBeacon;
    // local representation token address => token ID
    mapping(address => BridgeMessage.TokenId) public representationToCanonical;
    // hash of the tightly-packed TokenId => local representation token address
    // If the token is of local origin, this MUST map to address(0).
    mapping(bytes32 => address) public canonicalToRepresentation;

    // ============ Upgrade Gap ============

    // gap for upgrade safety
    uint256[49] private __GAP;

    // ============ Events ============

    /**
     * @notice emitted when a representation token contract is deployed
     * @param domain the domain of the chain where the canonical asset is deployed
     * @param id the bytes32 address of the canonical token contract
     * @param representation the address of the newly locally deployed representation contract
     */
    event TokenDeployed(
        uint32 indexed domain,
        bytes32 indexed id,
        address indexed representation
    );

    // ======== Initializer =========

    function initialize(address _tokenBeacon, address _xAppConnectionManager)
        public
        initializer
    {
        tokenBeacon = _tokenBeacon;
        __XAppConnectionClient_initialize(_xAppConnectionManager);
    }

    // ======== TokenId & Address Lookup for Representation Tokens =========

    /**
     * @notice Look up the canonical token ID for a representation token
     * @param _representation the address of the representation contract
     * @return _domain the domain of the canonical version.
     * @return _id the identifier of the canonical version in its domain.
     */
    function getCanonicalTokenId(address _representation)
        external
        view
        returns (uint32 _domain, bytes32 _id)
    {
        BridgeMessage.TokenId memory _canonical = representationToCanonical[
            _representation
        ];
        _domain = _canonical.domain;
        _id = _canonical.id;
    }

    /**
     * @notice Look up the representation address for a canonical token
     * @param _domain the domain of the canonical version.
     * @param _id the identifier of the canonical version in its domain.
     * @return _representation the address of the representation contract
     */
    function getRepresentationAddress(uint32 _domain, bytes32 _id)
        public
        view
        returns (address _representation)
    {
        bytes29 _tokenId = BridgeMessage.formatTokenId(_domain, _id);
        bytes32 _idHash = _tokenId.keccak();
        _representation = canonicalToRepresentation[_idHash];
    }

    // ======== External: Deploying Representation Tokens =========

    /**
     * @notice Get the address of the local token for the provided tokenId;
     * if the token is remote and no local representation exists, deploy the representation contract
     * @param _domain the token's native domain
     * @param _id the token's id on its native domain
     * @return _local the address of the local token contract
     */
    function ensureLocalToken(uint32 _domain, bytes32 _id)
        external
        override
        onlyOwner
        returns (address _local)
    {
        _local = getLocalAddress(_domain, _id);
        if (_local == address(0)) {
            // Representation does not exist yet;
            // deploy representation contract
            _local = _deployToken(_domain, _id);
        }
    }

    // ======== External: Enrolling Representation Tokens =========

    /**
     * @notice Enroll a custom token. This allows projects to work with
     * governance to specify a custom representation.
     * @dev This is done by inserting the custom representation into the token
     * lookup tables. It is permissioned to the owner (governance) and can
     * potentially break token representations. It must be used with extreme
     * caution.
     * After the token is inserted, new mint instructions will be sent to the
     * custom token. The default representation (and old custom representations)
     * may still be burnt. Until all users have explicitly called migrate, both
     * representations will continue to exist.
     * The custom representation MUST be trusted, and MUST allow the router to
     * both mint AND burn tokens at will.
     * @param _domain the domain of the canonical Token to enroll
     * @param _id the bytes32 ID of the canonical of the Token to enroll
     * @param _custom the address of the custom implementation to use.
     */
    function enrollCustom(
        uint32 _domain,
        bytes32 _id,
        address _custom
    ) external override onlyOwner {
        // update mappings with custom token
        _setRepresentationToCanonical(_domain, _id, _custom);
        _setCanonicalToRepresentation(_domain, _id, _custom);
    }

    // ======== Match Old Representation Tokens =========

    /**
     * @notice Returns the current representation contract
     * for the same canonical token as the old representation contract
     * @dev If _oldRepr is not a representation, this will error.
     * @param _oldRepr The address of the old representation token
     * @return _currentRepr The address of the current representation token
     */
    function oldReprToCurrentRepr(address _oldRepr)
        external
        view
        override
        returns (address _currentRepr)
    {
        // get the canonical token ID for the old representation contract
        BridgeMessage.TokenId memory _tokenId = representationToCanonical[
            _oldRepr
        ];
        require(_tokenId.domain != 0, "!repr");
        // get the current primary representation for the same canonical token ID
        _currentRepr = getRepresentationAddress(_tokenId.domain, _tokenId.id);
    }

    // ======== TokenId & Address Lookup for ALL Local Tokens (Representation AND Canonical) =========

    /**
     * @notice Return tokenId for a local token address
     * @param _local the local address of the token contract (representation or canonical)
     * @return _domain canonical domain
     * @return _id canonical identifier on that domain
     */
    function getTokenId(address _local)
        external
        view
        override
        returns (uint32 _domain, bytes32 _id)
    {
        BridgeMessage.TokenId memory _tokenId = representationToCanonical[
            _local
        ];
        if (_tokenId.domain == 0) {
            _domain = _localDomain();
            _id = TypeCasts.addressToBytes32(_local);
        } else {
            _domain = _tokenId.domain;
            _id = _tokenId.id;
        }
    }

    /**
     * @notice Looks up the local address corresponding to a domain/id pair.
     * @dev If the token is local, it will return the local address.
     * If the token is non-local and no local representation exists, this
     * will return `address(0)`.
     * @param _domain the domain of the canonical version.
     * @param _id the identifier of the canonical version in its domain.
     * @return _local the local address of the token contract (representation or canonical)
     */
    function getLocalAddress(uint32 _domain, address _id)
        external
        view
        returns (address _local)
    {
        _local = getLocalAddress(_domain, TypeCasts.addressToBytes32(_id));
    }

    /**
     * @notice Looks up the local address corresponding to a domain/id pair.
     * @dev If the token is local, it will return the local address.
     * If the token is non-local and no local representation exists, this
     * will return `address(0)`.
     * @param _domain the domain of the canonical version.
     * @param _id the identifier of the canonical version in its domain.
     * @return _local the local address of the token contract (representation or canonical)
     */
    function getLocalAddress(uint32 _domain, bytes32 _id)
        public
        view
        override
        returns (address _local)
    {
        if (_domain == _localDomain()) {
            // Token is of local origin
            _local = TypeCasts.bytes32ToAddress(_id);
        } else {
            // Token is a representation of a token of remote origin
            _local = getRepresentationAddress(_domain, _id);
        }
    }

    /**
     * @notice Return the local token contract for the
     * canonical tokenId; revert if there is no local token
     * @param _domain the token's native domain
     * @param _id the token's id on its native domain
     * @return the local IERC20 token contract
     */
    function mustHaveLocalToken(uint32 _domain, bytes32 _id)
        external
        view
        override
        returns (IERC20)
    {
        address _local = getLocalAddress(_domain, _id);
        require(_local != address(0), "!token");
        return IERC20(_local);
    }

    /**
     * @notice Determine if token is of local origin
     * @return TRUE if token is locally originating
     */
    function isLocalOrigin(address _token) external view override returns (bool) {
        // If the contract WAS deployed by the TokenRegistry,
        // it will be stored in this mapping.
        // If so, it IS NOT of local origin
        if (representationToCanonical[_token].domain != 0) {
            return false;
        }
        // If the contract WAS NOT deployed by the TokenRegistry,
        // and the contract exists, then it IS of local origin
        // Return true if code exists at _addr
        uint256 _codeSize;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            _codeSize := extcodesize(_token)
        }
        return _codeSize != 0;
    }

    // ======== Internal Functions =========

    /**
     * @notice Set the primary representation for a given canonical
     * @param _domain the domain of the canonical token
     * @param _id the bytes32 ID pf the canonical of the token
     * @param _representation the address of the representation token
     */
    function _setRepresentationToCanonical(
        uint32 _domain,
        bytes32 _id,
        address _representation
    ) internal {
        representationToCanonical[_representation].domain = _domain;
        representationToCanonical[_representation].id = _id;
    }

    /**
     * @notice Set the canonical token for a given representation
     * @param _domain the domain of the canonical token
     * @param _id the bytes32 ID pf the canonical of the token
     * @param _representation the address of the representation token
     */
    function _setCanonicalToRepresentation(
        uint32 _domain,
        bytes32 _id,
        address _representation
    ) internal {
        bytes29 _tokenId = BridgeMessage.formatTokenId(_domain, _id);
        bytes32 _idHash = _tokenId.keccak();
        canonicalToRepresentation[_idHash] = _representation;
    }

    /**
     * @notice Deploy and initialize a new token contract
     * @dev Each token contract is a proxy which
     * points to the token upgrade beacon
     * @return _token the address of the token contract
     */
    function _deployToken(uint32 _domain, bytes32 _id)
        internal
        returns (address _token)
    {
        // deploy and initialize the token contract
        _token = address(new UpgradeBeaconProxy(tokenBeacon, ""));
        // Initialize the token. Normally we initialize during proxy deployment
        // but due to a proxy quirk, it's clearer to do it explicitly when
        // calling an initializer with no arguments.
        IBridgeToken(_token).initialize();
        // set the default token name & symbol
        (string memory _name, string memory _symbol) = _defaultDetails(
            _domain,
            _id
        );
        IBridgeToken(_token).setDetails(_name, _symbol, 18);
        // transfer ownership to bridgeRouter
        IBridgeToken(_token).transferOwnership(owner());
        // store token in mappings
        _setCanonicalToRepresentation(_domain, _id, _token);
        _setRepresentationToCanonical(_domain, _id, _token);
        // emit event upon deploying new token
        emit TokenDeployed(_domain, _id, _token);
    }

    /**
     * @notice Get default name and details for a token
     *         Sets name to "[domain].[id]", and symbol to the first 15
     *         bytes of the name.
     * @dev Symbol of 15 bytes is chosen to ensure we don't accidentally break
     *      the foxy wallet
     * @param _domain the domain of the canonical token
     * @param _id the bytes32 ID pf the canonical of the token
     */
    function _defaultDetails(uint32 _domain, bytes32 _id)
        internal
        pure
        returns (string memory _name, string memory _symbol)
    {
        // get the first and second half of the token ID
        (, uint256 _secondHalfId) = Encoding.encodeHex(uint256(_id));
        // encode the default token name: "[decimal domain].[hex 4 bytes of ID]"
        _name = string(
            abi.encodePacked(
                Encoding.decimalUint32(_domain), // 10
                ".", // 1
                uint32(_secondHalfId) // 4
            )
        );
        // allocate the memory for a new 15-byte string
        _symbol = new string(10 + 1 + 4);
        assembly {
            mstore(add(_symbol, 0x20), mload(add(_name, 0x20)))
        }
    }

    /**
     * @dev explicit override for compiler inheritance
     * @dev explicit override for compiler inheritance
     * @return domain of chain on which the contract is deployed
     */
    function _localDomain()
        internal
        view
        override(XAppConnectionClient)
        returns (uint32)
    {
        return XAppConnectionClient._localDomain();
    }

    /**
    * @dev should be impossible to renounce ownership;
     * we override OpenZeppelin OwnableUpgradeable's
     * implementation of renounceOwnership to make it a no-op
     */
    function renounceOwnership() public override onlyOwner {
        // do nothing
    }
}
