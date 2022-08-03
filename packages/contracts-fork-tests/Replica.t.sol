// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import { Replica } from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import { TypeCasts } from "@nomad-xyz/contracts-core/contracts/libs/TypeCasts.sol";

abstract contract ReplicaForkTest is Test {
  uint256 ethereumFork;
  uint256 milkomedaFork;
  uint256 avalancheFork;
  uint256 evmosFork;
  uint256 moonbeamFork;
  uint256 xdaiFork;

  Replica ethereumReplica;
  Replica moonbeamReplica;
  Replica avalancheReplica;
  Replica xdaiReplica;
  Replica evmosReplica;

  uint32 remoteDomain;
  Replica replica;

  function setUp() public virtual {
    // Create forks for every network where Nomad is deployed
    // in production.
    ethereumFork = vm.createFork(vm.rpcUrl("ethereum"));
    // milkomedaFork = vm.createFork(vm.rpcUrl("milkomeda"));
    // evmosFork = vm.createFork(vm.rpcUrl("evmos"));
    // moonbeamFork = vm.createFork(vm.rpcUrl("moonbeam"));
    // avalancheFork = vm.createFork(vm.rpcUrl("avalanche"));
    // xdaiFork = vm.createFork(vm.rpcUrl("xdai"));
  }

  /*//////////////////////////////////////////////////////////////
                                  TOOLS
    //////////////////////////////////////////////////////////////*/

  /// @notice Sets a Replica's committedRoot by modifying
  /// directly the storage of the contract.
  function setReplicaCommittedRoot(bytes32 root) public {
    bytes32 committedRootSlot = bytes32(uint256(102));
    bytes32 confirmAtStartSlot = keccak256(
      abi.encodePacked(root, bytes32(uint256(153)))
    );
    vm.store(address(replica), committedRootSlot, root);
    // How mappings are placed in storage
    // https://docs.soliditylang.org/en/v0.8.13/internals/layout_in_storage.html
    vm.store(address(replica), confirmAtStartSlot, bytes32(uint256(1)));
    assertEq(replica.committedRoot(), root);
    assertEq(replica.confirmAt(root), 1);
  }

  function setUpdater(address updaterAddress) public {
    bytes32 committedRootSlot = bytes32(uint256(101));
    vm.store(
      address(replica),
      committedRootSlot,
      TypeCasts.addressToBytes32(updaterAddress)
    );
    assertEq(replica.updater(), updaterAddress);
  }

  function signUpdate(
    uint256 privKey,
    bytes32 oldRoot,
    bytes32 newRoot,
    uint32 domain
  ) public returns (bytes memory) {
    bytes32 digest = keccak256(getMessage(oldRoot, newRoot, domain));
    digest = keccak256(
      abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
    bytes memory signature = abi.encodePacked(r, s, v);
    return signature;
  }

  function getMessage(
    bytes32 oldRoot,
    bytes32 newRoot,
    uint32 domain
  ) public pure returns (bytes memory) {
    bytes memory message = abi.encodePacked(
      keccak256(abi.encodePacked(domain, "NOMAD")),
      oldRoot,
      newRoot
    );
    return message;
  }

  /*//////////////////////////////////////////////////////////////
                                  TESTS
    //////////////////////////////////////////////////////////////*/

  event Update(
    uint32 indexed domain,
    bytes32 indexed oldRoot,
    bytes32 indexed newRoot,
    bytes signature
  );

  function test_acceptReplicaUpdate() public {
    bytes32 oldRoot = replica.committedRoot();
    bytes32 newRoot = "newRoot";
    uint256 updaterPK = 420;
    address updater = vm.addr(updaterPK);
    setUpdater(updater);
    bytes memory sig = signUpdate(updaterPK, oldRoot, newRoot, remoteDomain);
    vm.expectEmit(true, true, true, true);
    emit Update(remoteDomain, oldRoot, newRoot, sig);
    replica.update(oldRoot, newRoot, sig);

    assertEq(
      replica.confirmAt(newRoot),
      block.timestamp + replica.optimisticSeconds()
    );
    assertEq(replica.committedRoot(), newRoot);
  }
}

abstract contract ReplicaEthereumTest is ReplicaForkTest {
  function setUp() public virtual override {
    super.setUp();
    vm.selectFork(ethereumFork);
  }
}

contract evmosReplicaOnEthereum is ReplicaEthereumTest {
  function setUp() public override {
    super.setUp();
    replica = Replica(0x5BAe47bF29F4E9B1E275C0b427B84C4DaA30033A);
    remoteDomain = replica.remoteDomain();
  }
}
