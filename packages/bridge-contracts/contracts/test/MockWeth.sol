// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {BridgeToken} from "../BridgeToken.sol";

contract MockWeth is BridgeToken {
    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
}
