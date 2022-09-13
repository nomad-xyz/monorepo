// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "@summa-tx/memview-sol/contracts/TypedMemView.sol";
import {QueueLib} from "../libs/Queue.sol";

contract QueueLibTest is Test {
    using QueueLib for QueueLib.Queue;

    QueueLib.Queue queue;
    bytes32 testItem;

    function setUp() public {
        queue.initialize();
        testItem = "I am lonely item";
    }

    function test_initialize() public {
        assertEq(uint256(queue.first), 1);
        assertEq(uint256(queue.last), 0);
        assertEq(queue.queue[0], 0);
        assertEq(queue.queue[1], 0);
    }

    function test_enqueueSingleItem() public {
        uint128 last = queue.enqueue(testItem);
        assertEq(uint256(queue.first), 1);
        assertEq(uint256(queue.last), 1);
        assertEq(uint256(last), 1);
        assertEq(queue.queue[1], testItem);
    }

    uint256 iterations;

    function test_enqueueSingleItemFuzzed(bytes32 item) public {
        iterations++;
        uint128 last = queue.enqueue(item);
        assertEq(uint256(queue.first), iterations);
        assertEq(uint256(queue.last), 1);
        assertEq(uint256(last), iterations);
        assertEq(queue.queue[iterations], item);
    }

    function test_dequeueSingleItem() public {
        test_enqueueSingleItem();
        assertEq(queue.queue[queue.first], testItem);
        bytes32 returnedItem = queue.dequeue();
        assertEq(returnedItem, testItem);
        assertEq(queue.queue[queue.first], bytes32(0));
        assertEq(uint256(queue.first), 2);
        assertEq(uint256(queue.last), 1);
        vm.expectRevert("Empty");
        queue.dequeue();
    }

    function test_enqueueMultipleItemsFuzzed(bytes32[40] memory data) public {
        bytes32[] memory items = new bytes32[](40);
        for (uint256 i; i < data.length; i++) {
            items[i] = data[i];
        }
        uint128 last = queue.enqueue(items);
        assertEq(uint256(last), 40);
        for (uint256 i; i < data.length; i++) {
            bytes32 item = queue.dequeue();
            assertEq(item, data[i]);
        }
    }

    function test_contains() public {
        queue.enqueue(testItem);
        assert(queue.contains(testItem));
        assertFalse(queue.contains("random item"));
        queue.dequeue();
        vm.expectRevert();
        assert(queue.contains(testItem));
    }

    function test_lastItem() public {
        queue.enqueue(testItem);
        assertEq(queue.lastItem(), testItem);
    }

    function test_isEmpty() public {
        assert(queue.isEmpty());
        queue.enqueue(testItem);
        assertFalse(queue.isEmpty());
    }

    function test_length() public {
        assertEq(queue.length(), 0);
        queue.enqueue(testItem);
        assertEq(queue.length(), 1);
    }

    function test__lengthFuzzed(uint128 last, uint128 first) public {
        vm.assume(last > first);
        assertEq(QueueLib._length(last, first), last + 1 - first);
    }
}
