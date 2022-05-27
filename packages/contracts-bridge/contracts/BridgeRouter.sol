// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// ============ Internal Imports ============
import {BridgeMessage} from "./BridgeMessage.sol";
import {IBridgeToken} from "./interfaces/IBridgeToken.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";
// ============ External Imports ============
import {XAppConnectionClient} from "@nomad-xyz/contracts-router/contracts/XAppConnectionClient.sol";
import {Router} from "@nomad-xyz/contracts-router/contracts/Router.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Version0} from "@nomad-xyz/contracts-core/contracts/Version0.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @title BridgeRouter
 */
contract BridgeRouter is Version0, Router {
    // ============ Libraries ============

    using TypedMemView for bytes;
    using TypedMemView for bytes29;
    using BridgeMessage for bytes29;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    // the amount transferred to bridgoors without gas funds
    uint256 public constant DUST_AMOUNT = 0.06 ether;

    // ============ Public Storage ============

    // contract that manages registry representation tokens
    ITokenRegistry public tokenRegistry;
    // token transfer prefill ID => LP that pre-filled message to provide fast liquidity
    mapping(bytes32 => address) public liquidityProvider;

    // ============ Upgrade Gap ============

    // gap for upgrade safety
    uint256[49] private __GAP;

    // ======== Events =========

    /**
     * @notice emitted when tokens are sent from this domain to another domain
     * @param token the address of the token contract
     * @param from the address sending tokens
     * @param toDomain the domain of the chain the tokens are being sent to
     * @param toId the bytes32 address of the recipient of the tokens
     * @param amount the amount of tokens sent
     * @param fastLiquidityEnabled True if fast liquidity is enabled, False otherwise
     */
    event Send(
        address indexed token,
        address indexed from,
        uint32 indexed toDomain,
        bytes32 toId,
        uint256 amount,
        bool fastLiquidityEnabled
    );

    /**
     * @notice emitted when tokens are dispensed to an account on this domain
     * emitted both when fast liquidity is provided, and when the transfer ultimately settles
     * @param originAndNonce Domain where the transfer originated and the unique identifier
     * for the message from origin to destination, combined in a single field ((origin << 32) & nonce)
     * @param token The address of the local token contract being received
     * @param recipient The address receiving the tokens; the original recipient of the transfer
     * @param liquidityProvider The account providing liquidity
     * @param amount The amount of tokens being received
     */
    event Receive(
        uint64 indexed originAndNonce,
        address indexed token,
        address indexed recipient,
        address liquidityProvider,
        uint256 amount
    );

    // ======== Receive =======
    receive() external payable {}

    // ======== Initializer ========

    function initialize(address _tokenRegistry, address _xAppConnectionManager)
        public
        initializer
    {
        tokenRegistry = ITokenRegistry(_tokenRegistry);
        __XAppConnectionClient_initialize(_xAppConnectionManager);
    }

    // ======== External: Handle =========

    /**
     * @notice Handles an incoming message
     * @param _origin The origin domain
     * @param _nonce The unique identifier for the message from origin to destination
     * @param _sender The sender address
     * @param _message The message
     */
    function handle(
        uint32 _origin,
        uint32 _nonce,
        bytes32 _sender,
        bytes memory _message
    ) external override onlyReplica onlyRemoteRouter(_origin, _sender) {
        // parse tokenId and action from message
        bytes29 _msg = _message.ref(0).mustBeMessage();
        bytes29 _tokenId = _msg.tokenId();
        bytes29 _action = _msg.action();
        // handle message based on the intended action
        if (_action.isTransfer()) {
            _handleTransfer(_origin, _nonce, _tokenId, _action, false);
        } else if (_action.isFastTransfer()) {
            _handleTransfer(_origin, _nonce, _tokenId, _action, true);
        } else {
            require(false, "!valid action");
        }
    }

    // ======== External: Send Token =========

    /**
     * @notice Send tokens to a recipient on a remote chain
     * @param _token The token address
     * @param _amount The token amount
     * @param _destination The destination domain
     * @param _recipient The recipient address
     */
    function send(
        address _token,
        uint256 _amount,
        uint32 _destination,
        bytes32 _recipient,
        bool /*_enableFast - deprecated field, left argument for backwards compatibility */
    ) external {
        require(_amount > 0, "!amnt");
        require(_recipient != bytes32(0), "!recip");
        // get remote BridgeRouter address; revert if not found
        bytes32 _remote = _mustHaveRemote(_destination);
        // Setup vars used in both if branches
        IBridgeToken _t = IBridgeToken(_token);
        bytes32 _detailsHash;
        // remove tokens from circulation on this chain
        if (tokenRegistry.isLocalOrigin(_token)) {
            // if the token originates on this chain,
            // hold the tokens in escrow in the Router
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
            // query token contract for details and calculate detailsHash
            _detailsHash = BridgeMessage.getDetailsHash(
                _t.name(),
                _t.symbol(),
                _t.decimals()
            );
        } else {
            // if the token originates on a remote chain,
            // burn the representation tokens on this chain
            _t.burn(msg.sender, _amount);
            _detailsHash = _t.detailsHash();
        }
        // format Transfer Tokens action
        bytes29 _action = BridgeMessage.formatTransfer(
            _recipient,
            _amount,
            _detailsHash
        );
        // get the tokenID
        (uint32 _domain, bytes32 _id) = tokenRegistry.getTokenId(_token);
        bytes29 _tokenId = BridgeMessage.formatTokenId(_domain, _id);
        // send message to remote chain via Nomad
        Home(xAppConnectionManager.home()).dispatch(
            _destination,
            _remote,
            BridgeMessage.formatMessage(_tokenId, _action)
        );
        // emit Send event to record token sender
        emit Send(
            _token,
            msg.sender,
            _destination,
            _recipient,
            _amount,
            false
        );
    }

    // ======== External: Custom Tokens =========

    /**
     * @notice Enroll a custom token. This allows projects to work with
     * governance to specify a custom representation.
     * @param _domain the domain of the canonical Token to enroll
     * @param _id the bytes32 ID of the canonical of the Token to enroll
     * @param _custom the address of the custom implementation to use.
     */
    function enrollCustom(
        uint32 _domain,
        bytes32 _id,
        address _custom
    ) external onlyOwner {
        // Sanity check. Ensures that human error doesn't cause an
        // unpermissioned contract to be enrolled.
        IBridgeToken(_custom).mint(address(this), 1);
        IBridgeToken(_custom).burn(address(this), 1);
        tokenRegistry.enrollCustom(_domain, _id, _custom);
    }

    /**
     * @notice Migrate all tokens in a previous representation to the latest
     * custom representation. This works by looking up local mappings and then
     * burning old tokens and minting new tokens.
     * @dev This is explicitly opt-in to allow dapps to decide when and how to
     * upgrade to the new representation.
     * @param _oldRepr The address of the old token to migrate
     */
    function migrate(address _oldRepr) external {
        address _currentRepr = tokenRegistry.oldReprToCurrentRepr(_oldRepr);
        require(_currentRepr != _oldRepr, "!different");
        // burn the total balance of old tokens & mint the new ones
        IBridgeToken _old = IBridgeToken(_oldRepr);
        uint256 _bal = _old.balanceOf(msg.sender);
        _old.burn(msg.sender, _bal);
        IBridgeToken(_currentRepr).mint(msg.sender, _bal);
    }

    // ============ Internal: Handle ============

    /**
     * @notice Handles an incoming Transfer message.
     *
     * If the token is of local origin, the amount is sent from escrow.
     * Otherwise, a representation token is minted.
     *
     * @param _origin The domain of the chain from which the transfer originated
     * @param _nonce The unique identifier for the message from origin to destination
     * @param _tokenId The token ID
     * @param _action The action
     * @param _fastEnabled True if fast liquidity was enabled, False otherwise
     */
    function _handleTransfer(
        uint32 _origin,
        uint32 _nonce,
        bytes29 _tokenId,
        bytes29 _action,
        bool _fastEnabled
    ) internal {
        // get the token contract for the given tokenId on this chain;
        // (if the token is of remote origin and there is
        // no existing representation token contract, the TokenRegistry will
        // deploy a new one)
        address _token = tokenRegistry.ensureLocalToken(
            _tokenId.domain(),
            _tokenId.id()
        );
        // load the original recipient of the tokens
        address _recipient = _action.evmRecipient();
        if (_fastEnabled) {
            // If an LP has prefilled this token transfer,
            // send the tokens to the LP instead of the recipient
            bytes32 _id = BridgeMessage.getPreFillId(
                _origin,
                _nonce,
                _tokenId,
                _action
            );
            address _lp = liquidityProvider[_id];
            if (_lp != address(0)) {
                _recipient = _lp;
                delete liquidityProvider[_id];
            }
        }
        // load amount once
        uint256 _amount = _action.amnt();
        // send the tokens into circulation on this chain
        if (tokenRegistry.isLocalOrigin(_token)) {
            // if the token is of local origin, the tokens have been held in
            // escrow in this contract
            // while they have been circulating on remote chains;
            // transfer the tokens to the recipient
            IERC20(_token).safeTransfer(_recipient, _amount);
        } else {
            // if the token is of remote origin, mint the tokens to the
            // recipient on this chain
            IBridgeToken(_token).mint(_recipient, _amount);
            // Tell the token what its detailsHash is
            IBridgeToken(_token).setDetailsHash(_action.detailsHash());
        }
        // dust the recipient if appropriate
        _dust(_recipient);
        // emit Receive event
        emit Receive(
            _originAndNonce(_origin, _nonce),
            _token,
            _recipient,
            address(0),
            _amount
        );
    }

    // ============ Internal: Dust with Gas ============

    /**
     * @notice Dust the recipient. This feature allows chain operators to use
     * the Bridge as a faucet if so desired. Any gas asset held by the
     * bridge will be slowly sent to users who need initial gas bootstrapping
     * @dev Does not dust if insufficient funds, or if user has funds already
     */
    function _dust(address _recipient) internal {
        if (
            _recipient.balance < DUST_AMOUNT &&
            address(this).balance >= DUST_AMOUNT
        ) {
            // `send` gives execution 2300 gas and returns a `success` boolean.
            // however, we do not care if the call fails. A failed call
            // indicates a smart contract attempting to execute logic, which we
            // specifically do not want.
            // While we could check EXTCODESIZE, it seems sufficient to rely on
            // the 2300 gas stipend to ensure that no state change logic can
            // be executed.
            payable(_recipient).send(DUST_AMOUNT);
        }
    }

    // ============ Internal: Utils ============

    /**
     * @notice Internal utility function that combines
     * `_origin` and `_nonce`.
     * @dev Both origin and nonce should be less than 2^32 - 1
     * @param _origin Domain of chain where the transfer originated
     * @param _nonce The unique identifier for the message from origin to destination
     * @return Returns (`_origin` << 32) & `_nonce`
     */
    function _originAndNonce(uint32 _origin, uint32 _nonce)
        internal
        pure
        returns (uint64)
    {
        return (uint64(_origin) << 32) | _nonce;
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
