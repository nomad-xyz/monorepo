// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract MockBeaconNotAddr {
    address public implementation;
    address public controller;
    string public trash;

    constructor(address _impl, address _cont) {
        implementation = _impl;
        controller = _cont;
        trash = "ima wreck this beacon";
    }

    fallback() external payable {
        // snippet from UpgradeBeacon.sol which extracts the implementation address
        // from the calldata. The Controller doesn't encode any function signature, but
        // only encodes the address of the implementation. The Beacon checks if the
        // calling address is the controller and proceeds to do the special functionality.
        if (msg.sender != controller) {
            assembly {
                mstore(0, sload(2))
                return(0, 32)
            }
        } else {
            // if called by the controller,
            // load new implementation address from the first word of the calldata
            address _newImplementation;
            assembly {
                _newImplementation := calldataload(0)
            }
            // set the new implementation
            implementation = _newImplementation;
        }
    }
}
