// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

// TODO: When we move away from Hardhat, we should change the relative path
// to absolute (in relation to the root of the project/git)
import {IEventAccountant} from "../../interfaces/IEventAccountant.sol";

interface IBridgeRouterHarness {
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event Receive(
        uint64 indexed originAndNonce,
        address indexed token,
        address indexed recipient,
        address liquidityProvider,
        uint256 amount
    );
    event Send(
        address indexed token,
        address indexed from,
        uint32 indexed toDomain,
        bytes32 toId,
        uint256 amount,
        bool fastLiquidityEnabled
    );

    function accountant() external returns (IEventAccountant);

    function DUST_AMOUNT() external view returns (uint256);

    function VERSION() external view returns (uint8);

    function enrollCustom(
        uint32 _domain,
        bytes32 _id,
        address _custom
    ) external;

    function enrollRemoteRouter(uint32 _domain, bytes32 _router) external;

    function handle(
        uint32 _origin,
        uint32 _nonce,
        bytes32 _sender,
        bytes memory _message
    ) external;

    function initialize(address _tokenRegistry, address _xAppConnectionManager)
        external;

    function liquidityProvider(bytes32) external view returns (address);

    function migrate(address _oldRepr) external;

    function owner() external view returns (address);

    function remotes(uint32) external view returns (bytes32);

    function renounceOwnership() external;

    function send(
        address _token,
        uint256 _amount,
        uint32 _destination,
        bytes32 _recipient,
        bool
    ) external;

    function sendToHook(
        address _token,
        uint256 _amount,
        uint32 _destination,
        bytes32 _remoteHook,
        bytes calldata _extraData
    ) external;

    function setXAppConnectionManager(address _xAppConnectionManager) external;

    function tokenRegistry() external view returns (address);

    function transferOwnership(address newOwner) external;

    function xAppConnectionManager() external view returns (address);

    function exposed_takeTokens(address token, uint256 amount)
        external
        returns (bytes29 _tokenId, bytes32 _detailsHash);

    function exposed_sendTransferMessage(
        uint32 dest,
        bytes memory tokenId,
        bytes memory action
    ) external;

    function exposed_giveLocal(
        address token,
        uint256 amount,
        address recipient
    ) external;

    function exposed_handleTransferToHook(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action
    ) external;

    function exposed_handleTransfer(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action
    ) external;

    function exposed_giveTokens(
        uint32 origin,
        uint32 nonce,
        bytes memory tokenId,
        bytes memory action,
        address recipient
    ) external returns (address);

    function exposed_dust(address account) external;

    function exposed_originAndNonce(uint32 origin, uint32 nonce)
        external
        returns (uint64);
}
