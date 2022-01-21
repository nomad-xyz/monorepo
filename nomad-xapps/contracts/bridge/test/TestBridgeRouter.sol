// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import "../BridgeRouter.sol";

// ============ External Imports ============

contract TestBridgeRouter is BridgeRouter {
    function dustEmUp(address _dustee) external {
        _dust(_dustee);
    }

    function drain() external returns (bool _sent) {
        _sent = msg.sender.send(address(this).balance);
    }
}

contract CantBePaid {
    receive() external payable {
        revert("NOPE");
    }
}
