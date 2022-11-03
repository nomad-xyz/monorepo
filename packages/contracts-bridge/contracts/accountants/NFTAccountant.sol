// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// ============ Internal Imports ============
import {EventAccountant} from "./EventAccountant.sol";
// ============ External Imports ============
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract NFTAccountant is
    EventAccountant,
    ERC721Upgradeable,
    OwnableUpgradeable
{
    /// No asset had 2**96 stolen, so we can pack nicely here :)
    struct Record {
        address asset;
        uint96 amount;
        address originalUser;
        uint96 recovered;
    }

    /// @notice next NFT ID
    uint256 public nextID;
    /// @notice maps NFT ID to NFT details
    mapping(uint256 => Record) public records;
    /// @notice token address => amount minted
    mapping(address => uint256) public totalMinted;

    // ============ Upgrade Gap ============

    // gap for upgrade safety
    uint256[47] private __GAP;

    /**
     * @notice emitted when tokens would have been transferred, but the asset
     *         was in the affected assets list
     * @param id The token ID of the NFT minted
     * @param asset The address of the affected token contract
     * @param recipient The intended recipient of the tokens; the recipient in the
     *                  transfer message
     * @param amount The amount of tokens that would have been received
     */
    event ProcessFailure(
        uint256 indexed id,
        address indexed asset,
        address indexed recipient,
        uint256 amount
    );

    /// ============ Constructor ============
    constructor(address _bridgeRouter) EventAccountant(_bridgeRouter) {}

    function initialize() public initializer {
        __EventAccountant_init();
        __ERC721_init("Nomad NFT", "noNFT");
        _setBaseURI("https://nft.nomad.xyz/");
        __Ownable_init();
    }

    /**
     * @notice Records information to state and logs a ProcessFailure event
     * @param _asset  The asset
     * @param _user   The recipient
     * @param _amount The amount
     */
    function _record(
        address _asset,
        address _user,
        uint256 _amount
    ) internal override {
        // mint the NFT
        uint256 _id = nextID;
        nextID = _id + 1;
        _safeMint(_user, _id);
        records[_id].asset = _asset;
        records[_id].amount = uint96(_amount);
        records[_id].originalUser = _user;
        // setting recovered is skipped, as it starts at 0
        // increment totalMinted
        totalMinted[_asset] += _amount;
        // ensure we mint at most the totalAffected amount
        // note: this also implicitly ensures that _asset is one of the affected assets
        require(totalMinted[_asset] <= totalAffected[_asset], "overmint");
        // emit event
        emit ProcessFailure(_id, _asset, _user, _amount);
    }

    /**
     * @notice Override to disable transfers
     */
    function transferFrom(
        address, /*from*/
        address, /*to*/
        uint256 /*tokenId*/
    ) public virtual override {
        _noTransfers();
    }

    /**
     * @notice Override to disable transfers
     */
    function safeTransferFrom(
        address, /*from*/
        address, /*to*/
        uint256 /*tokenId*/
    ) public virtual override {
        _noTransfers();
    }

    /**
     * @notice Override to disable transfers
     */
    function safeTransferFrom(
        address, /*from*/
        address, /*to*/
        uint256, /*tokenId*/
        bytes memory /*data*/
    ) public virtual override {
        _noTransfers();
    }

    /**
     * @notice Revert with the same error message on any attempted transfers
     */
    function _noTransfers() internal pure {
        revert("no transfers");
    }
}

/// @title NFTRecoveryAccountant
abstract contract NFTRecoveryAccountant is NFTAccountant {
    using SafeERC20 for IERC20;

    /// @notice the address that receives funds
    /// that should not have been transferred to the contract
    address public immutable fundsRecipient;

    /// @notice token address => total amount collected
    mapping(address => uint256) public totalCollected;
    /// @notice token address => total amount recovered to users
    mapping(address => uint256) public totalRecovered;

    // ============ Upgrade Gap ============

    // gap for upgrade safety
    uint256[48] private __GAP;

    /**
     * @notice A recovery event.
     * @param id The tokenId recovering funds
     * @param asset The asset being transferred
     * @param recipient The user receiving the asset
     * @param amount The amount transferred to the user
     */
    event Recovery(
        uint256 indexed id,
        address indexed asset,
        address indexed recipient,
        uint256 amount
    );

    /// ============ Constructor ============
    constructor(address _bridgeRouter, address _fundsRecipient)
        NFTAccountant(_bridgeRouter)
    {
        fundsRecipient = _fundsRecipient;
    }

    /**
     * @notice Return all pertinent state information for an asset in a single RPC call for convenience
     * @return _totalAffected total amount of tokens affected
     * @return _totalMinted total amount minted in NFTs from unbridging this
     *         asset
     * @return _totalCollected lifetime total amount of this asset that has
     *         passed through the account
     * @return _totalRecovered total amount of this asset recovered by users
     */
    function assetInfo(address _asset)
        external
        view
        returns (
            uint256 _totalAffected,
            uint256 _totalMinted,
            uint256 _totalCollected,
            uint256 _totalRecovered
        )
    {
        _totalAffected = totalAffected[_asset];
        _totalMinted = totalMinted[_asset];
        _totalCollected = totalCollected[_asset];
        _totalRecovered = totalRecovered[_asset];
    }

    /**
     * @notice Remove funds that should not have been transferred to this contract
     */
    function remove(address _asset, uint256 _amount) external onlyOwner {
        IERC20(_asset).safeTransfer(fundsRecipient, _amount);
        require(
            IERC20(_asset).balanceOf(address(this)) >=
                totalCollected[_asset] - totalRecovered[_asset],
            "!remove amount"
        );
    }

    /**
     * @notice Collect funds to be recovered by users
     * @param _handler address handling tokens
     * @param _asset token to make available to recover
     * @param _amount amount to make available to recover
     * @dev Prior to the contract owner calling this method,
     * the _handler must Approve this contract to spend _amount
     */
    function collect(
        address _handler,
        address _asset,
        uint256 _amount
    ) external onlyOwner {
        // transfer tokens from holder to this contract
        IERC20(_asset).safeTransferFrom(_handler, address(this), _amount);
        // increment totalCollected
        totalCollected[_asset] += _amount;
    }

    /**
     * @notice The current total amount of funds that can be recovered by a
     *         tokenId
     */
    function recoverable(uint256 _id) public view returns (uint256) {
        require(_exists(_id), "recoverable: nonexistent token");
        Record memory _rec = records[_id];
        return _recoverable(_rec);
    }

    /**
     * @notice Recover the available funds
     */
    function _recover(uint256 _id) internal {
        address _user = ownerOf(_id);
        require(_user == msg.sender, "only NFT holder can recover");
        // calculate the amount to be recovered
        Record memory _rec = records[_id];
        uint256 _amount = _recoverable(_rec);
        require(_amount != 0, "currently fully recovered");
        // increment the asset's totalRecovered and the NFT's recovered field
        address _asset = _rec.asset;
        totalRecovered[_asset] += _amount;
        records[_id].recovered += uint96(_amount);
        // emit event
        emit Recovery(_id, _asset, _user, _amount);
        // transfer the asset to user
        IERC20(_asset).safeTransfer(_user, _amount);
    }

    /**
     * @notice The current total amount of funds recoverable for a tokenId
     */
    function _recoverable(Record memory _rec) internal view returns (uint256) {
        uint256 _totalRecoverable = (totalCollected[_rec.asset] *
            uint256(_rec.amount)) / totalAffected[_rec.asset];
        // ensure subtraction does not underflow
        if (_totalRecoverable < uint256(_rec.recovered)) return 0;
        // return total recoverable amount minus amount already recovered
        return _totalRecoverable - uint256(_rec.recovered);
    }
}

/// @title AllowListRecoveryAccountant
contract AllowListNFTRecoveryAccountant is NFTRecoveryAccountant {
    /// @notice Maps address to allowed status
    mapping(address => bool) public allowList;

    // ============ Upgrade Gap ============

    // gap for upgrade safety
    uint256[49] private __GAP;

    constructor(address _bridgeRouter, address _fundsRecipient)
        NFTRecoveryAccountant(_bridgeRouter, _fundsRecipient)
    {}

    /**
     * @notice Requires that `msg.sender` is on the allowList
     */
    modifier onlyAllowed() {
        require(allowList[msg.sender], "not allowed");
        _;
    }

    /**
     * @notice Recover available funds for the NFT
     */
    function recover(uint256 _id) external onlyAllowed {
        _recover(_id);
    }

    /**
     * @notice Adds addresses to the allow list
     * @param _who A list of addresses to allow
     */
    function allow(address[] calldata _who) external onlyOwner {
        for (uint256 i = 0; i < _who.length; i++) {
            allowList[_who[i]] = true;
        }
    }

    /**
     * @notice Removes addresses from the allow list
     * @param _who A list of addresses to disallow
     */
    function disallow(address[] calldata _who) external onlyOwner {
        for (uint256 i = 0; i < _who.length; i++) {
            allowList[_who[i]] = false;
        }
    }

    /**
     * @notice Return all pertinent state information for a tokenId in a single
     *         RPC call for convenience
     * @return _holder address of the current token holder
     * @return _isAllowed TRUE if the current token holder is set on the
     *         allowlist & can therefore call recovery
     * @return _uri the tokenURI for the NFT
     * @return _asset address of the ERC20 asset for this NFT
     * @return _originalAmount amount of the bridge transfer which minted this
     *         NFT
     * @return _originalUser original recipient of the NFT
     * @return _recovered total amount recovered thus far from this NFT
     * @return _recoverable current amount recoverable for this NFT
     */
    function info(uint256 _id)
        external
        view
        returns (
            address _holder,
            bool _isAllowed,
            string memory _uri,
            address _asset,
            uint256 _originalAmount,
            address _originalUser,
            uint256 _recovered,
            uint256 _recoverable
        )
    {
        _holder = ownerOf(_id);
        _isAllowed = allowList[_holder];
        _uri = tokenURI(_id);
        Record memory _rec = records[_id];
        _asset = _rec.asset;
        _originalAmount = uint256(_rec.amount);
        _originalUser = _rec.originalUser;
        _recovered = uint256(_rec.recovered);
        _recoverable = recoverable(_id);
    }
}
