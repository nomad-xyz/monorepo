// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import {QueueManagerHarness} from "./harnesses/QueueHarness.sol";

contract QueueManagerTest is Test {
    QueueManagerHarness queueManager;

    function setUp() public {
        queueManager = new QueueManagerHarness();
        queueManager.exposed___QueueManager_initialize();
    }

    function test_queueLength() public {
        assertEq(queueManager.queueLength(), 0);
    }

    function test_queueContains() public {
        bytes32 testItem = "test";
        assertFalse(queueManager.queueContains(testItem));
        queueManager.exposed_enqueue(testItem);
        assert(queueManager.queueContains(testItem));
    }

    function test_queueEnd() public {
        assertEq(queueManager.queueEnd(), bytes32(0));
        bytes32 testItem = "test";
        queueManager.exposed_enqueue(testItem);
        assertEq(queueManager.queueEnd(), testItem);
    }
}
