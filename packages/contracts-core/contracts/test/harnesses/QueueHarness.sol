// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import {QueueManager} from "../../Queue.sol";
import {QueueLib} from "../../libs/Queue.sol";

contract QueueManagerHarness is QueueManager {
    using QueueLib for QueueLib.Queue;

    function exposed___QueueManager_initialize() external {
        __QueueManager_initialize();
    }

    function exposed_enqueue(bytes32 item) public returns (uint128) {
        return queue.enqueue(item);
    }

    function exposed_dequeue() public returns (bytes32) {
        return queue.dequeue();
    }
}
