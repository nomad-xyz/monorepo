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
        bytes memory message = abi.encodePacked(
            keccak256(abi.encodePacked(domain, "NOMAD")),
            oldRoot,
            newRoot
        );
        return message;
    }

    function signUpdate(
        uint256 privKey,
        bytes32 oldRoot,
        bytes32 newRoot
    ) public returns (bytes memory) {
        bytes32 digest = keccak256(getMessage(oldRoot, newRoot));
        digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        return signature;
    }
}
