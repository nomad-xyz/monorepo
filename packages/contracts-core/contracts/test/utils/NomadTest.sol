// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import {Vm} from "forge-std/Vm.sol";
import {stdCheats, stdError} from "forge-std/stdlib.sol";
import {console} from "forge-std/console.sol";
import {DSTest} from "ds-test/test.sol";

contract NomadTest is DSTest, stdCheats {
    Vm public constant vm = Vm(HEVM_ADDRESS);

    uint256 updaterPK = 1;
    address updater = vm.addr(updaterPK);
    address fakeUpdater = vm.addr(2);
    address signer = vm.addr(3);
    address fakeSigner = vm.addr(4);

    uint32 domain = 1000;

    function setUp() public virtual {
        vm.label(updater, "updater");
        vm.label(fakeUpdater, "fake updater");
        vm.label(signer, "signer");
        vm.label(fakeSigner, "fake signer");
    }

    function getMessage(bytes32 oldRoot, bytes32 newRoot)
        public
        returns (bytes memory)
    {
        bytes memory message = new bytes(68);
        assembly {
            mstore(add(message, 0x04), sload(domain.slot))
            mstore(add(message, 0x24), oldRoot)
            mstore(add(message, 0x44), newRoot)
        }
        console.log(unicode"Message⇲");
        console.logBytes(message);
        return message;
    }

    function signUpdate(
        uint256 privKey,
        bytes32 oldRoot,
        bytes32 newRoot
    ) public returns (bytes memory) {
        bytes memory message = getMessage(oldRoot, newRoot);

        bytes32 hash = keccak256(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, hash);
        bytes memory signature = new bytes(65);
        assembly {
            mstore(add(signature, 32), r)
            mstore(add(signature, 64), s)
            mstore(add(signature, 64), v)
        }
        return signature;
    }
}
