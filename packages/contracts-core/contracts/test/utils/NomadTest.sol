// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.6.11;

import "forge-std/Test.sol";
import "../../UpdaterManager.sol";

contract NomadTest is Test {
    uint256 updaterPK = 1;
    uint256 fakeUpdaterPK = 2;
    address updater = vm.addr(updaterPK);
    address fakeUpdater = vm.addr(fakeUpdaterPK);
    address signer = vm.addr(3);
    address fakeSigner = vm.addr(4);

    uint32 homeDomain = 1000;
    uint32 remoteDomain = 1500;

    function setUp() public virtual {
        vm.label(updater, "updater");
        vm.label(fakeUpdater, "fake updater");
        vm.label(signer, "signer");
        vm.label(fakeSigner, "fake signer");
    }

    function getMessage(bytes32 oldRoot, bytes32 newRoot, uint32 domain)
        public
        view
        returns (bytes memory)
    {
        bytes memory message = abi.encodePacked(
            keccak256(abi.encodePacked(domain, "NOMAD")),
            oldRoot,
            newRoot
        );
        return message;
    }

    function signHomeUpdate(
        uint256 privKey,
        bytes32 oldRoot,
        bytes32 newRoot
    ) public returns (bytes memory) {
        bytes32 digest = keccak256(getMessage(oldRoot, newRoot, homeDomain));
        digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        return signature;
    }


    function signRemoteUpdate(
        uint256 privKey,
        bytes32 oldRoot,
        bytes32 newRoot
    ) public returns (bytes memory) {
        bytes32 digest = keccak256(getMessage(oldRoot, newRoot, remoteDomain));
        digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        return signature;
    }
}

contract NomadTestWithUpdaterManager is NomadTest {
    UpdaterManager updaterManager;

    function setUp() public virtual override {
        super.setUp();
        updaterManager = new UpdaterManager(updater);
    }
}
