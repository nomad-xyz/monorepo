// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import {GovernanceRouter} from "../../governance/GovernanceRouter.sol";
import {GovernanceMessage} from "../../governance/GovernanceMessage.sol";
import {TypedMemView} from "@summa-tx/memview-sol/contracts/TypedMemView.sol";

import "forge-std/console2.sol";

contract GovernanceRouterHarness is GovernanceRouter {
    using GovernanceMessage for bytes29;
    using TypedMemView for bytes;
    using TypedMemView for bytes29;

    constructor(uint32 _localDomain, uint256 _recoveryTimelock)
        GovernanceRouter(_localDomain, _recoveryTimelock)
    {}

    function exposed_callRemote(
        uint32 _destination,
        GovernanceMessage.Call[] calldata _calls
    ) public {
        _callRemote(_destination, _calls);
    }

    function exposed_callLocal(GovernanceMessage.Call memory _call)
        public
        returns (bytes memory _ret)
    {
        return _callLocal(_call);
    }

    function exposed_setRemoteGovernor(uint32 domain, bytes32 router) public {
        // non-local governor
        governor = address(0);
        governorDomain = domain;
        _setRouter(domain, router);
    }

    /// @notice Exposed internal _handleBatch function to be tested
    /// @dev We can't directly pass a bytes29 view because it's a pointer
    /// to the memory and thus relevant only to the contract in which
    /// it was defined. Thus, we define it here, instead inside the
    /// test contract.
    /// @param message in bytes
    /// @param viewType the type to which the view will be casted
    function exposed_handleBatch(bytes memory message, uint40 viewType) public {
        _handleBatch(message.ref(viewType));
    }

    function exposed_setRouter(uint32 domain, bytes32 newRouter) external {
        _setRouter(domain, newRouter);
    }

    function exposed_isGovernorRouter(uint32 domain, bytes32 addr)
        external
        view
        returns (bool)
    {
        return _isGovernorRouter(domain, addr);
    }

    function exposed_mustHaveRouter(uint32 domain)
        external
        view
        returns (bytes32)
    {
        return _mustHaveRouter(domain);
    }

    function hack_domainsLength() public view returns (uint256) {
        return domains.length;
    }
}
