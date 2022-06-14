// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
    //////////////////////////////////////////////////////////////*/

// Contracts to be upgraded
import { Home } from "../../../contracts-core/contracts/Home.sol";
import { Replica } from "../../../contracts-core/contracts/Replica.sol";
import { XAppConnectionManager } from "../../../contracts-core/contracts/XAppConnectionManager.sol";
import { GovernanceRouter } from "../../../contracts-core/contracts/governance/GovernanceRouter.sol";
import { BridgeRouter } from "../../../contracts-bridge/contracts/BridgeRouter.sol";
import { BridgeToken } from "../../../contracts-bridge/contracts/BridgeToken.sol";
import { TokenRegistry } from "../../../contracts-bridge/contracts/TokenRegistry.sol";
import { UpgradeBeaconController } from "../../../contracts-core/contracts/upgrade/UpgradeBeaconController.sol";

import { Upgrade } from "../Upgrade.sol";

// Utilities
import { GovernanceMessage } from "../../../contracts-core/contracts/governance/GovernanceMessage.sol";
import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";
import { TypeCasts } from "../../../contracts-core/contracts/libs/TypeCasts.sol";
import { MerkleTest } from "../../../contracts-core/contracts/test/utils/MerkleTest.sol";
import { Message } from "../../../contracts-core/contracts/libs/Message.sol";
import { GoodXappSimple } from "../../../contracts-core/contracts/test/utils/GoodXapps.sol";

contract LegacyFixture is Upgrade {
  Replica replica;
  UpgradeBeaconController beaconControllerContract;

  address homeProxy;
  address replicaProxy;
  address governanceRouterProxy;
  address bridgeRouterProxy;
  address bridgeTokenProxy;
  address tokenRegistryProxy;

  GoodXappSimple goodXappSimple;
  MerkleTest merkleTest;

  // Message has only been proven
  bytes legacyProveMessage;
  bytes32 legacyProveRoot;
  bytes32 legacyProveLeaf;
  uint256 legacyProveIndex;
  bytes32[32] legacyProveProof;

  // Message has been processed
  bytes legacyProcessMessage;
  bytes32 legacyProcessRoot;
  bytes32 legacyProcessLeaf;
  uint256 legacyProcessIndex;
  bytes32[32] legacyProcessProof;

  uint32 remoteDomain = 1500;

  function setUp() public virtual {
    env_getProxyAddresses();
    replica = Replica(replicaProxy);

    goodXappSimple = new GoodXappSimple();
    merkleTest = new MerkleTest();

    legacyFirstProve();
    legacyFirstProcess();
  }

  function legacyFirstProve() public {
    bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
    bytes32 receiver = bytes32(uint256(uint160(address(goodXappSimple))));
    uint32 nonce = 0;
    bytes memory messageBody = "legacyFirstProve";
    bytes memory message = Message.formatMessage(
      remoteDomain,
      sender,
      nonce,
      replica.localDomain(),
      receiver,
      messageBody
    );
    (
      bytes32 root,
      bytes32 leaf,
      uint256 index,
      bytes32[32] memory proof
    ) = merkleTest.getProof(message);

    legacyProveRoot = root;
    legacyProveLeaf = leaf;
    legacyProveIndex = index;
    legacyProveProof = proof;
    legacyProveMessage = message;
    setReplicaCommittedRoot(root);
    assertTrue(replica.prove(leaf, proof, index));
  }

  function legacyFirstProcess() public {
    bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
    bytes32 receiver = bytes32(uint256(uint160(address(goodXappSimple))));
    uint32 nonce = 0;
    bytes memory messageBody = "0x";
    bytes memory message = Message.formatMessage(
      remoteDomain,
      sender,
      nonce,
      replica.localDomain(),
      receiver,
      messageBody
    );
    (
      bytes32 root,
      bytes32 leaf,
      uint256 index,
      bytes32[32] memory proof
    ) = merkleTest.getProof(message);
    setReplicaCommittedRoot(root);

    legacyProcessRoot = root;
    legacyProcessLeaf = leaf;
    legacyProcessIndex = index;
    legacyProcessProof = proof;
    legacyProcessMessage = message;
    replica.proveAndProcess(message, proof, index);
  }

  function env_getProxyAddresses() public {
    replicaProxy = vm.envAddress("NOMAD_REPLICA_PROXY");
    governanceRouterProxy = vm.envAddress("NOMAD_GOV_ROUTER_PROXY");
    // homeProxy = vm.envAddress("NOMAD_HOME_PROXY");
    // bridgeRouterProxy = vm.envAddress("NOMAD_BRIDGE_ROUTER_PROXY");
    // bridgeTokenProxy = vm.envAddress("NOMAD_BRIDGE_TOKEN_PROXY");
    // tokenRegistryProxy = vm.envAddress("NOMAD_TOKEN_REGISTRY_PROXY");
  }

  // At commit: 4679f48f0f7392849e75a17487c4bfd6b9d08f33, this is the storage layout of Replica:
  // FOUNDRY_PROFILE=core forge inspect Replica --pretty storage-layout
  // +-------------------+-----------------------------+------+--------+-------+
  // | Name              | Type                        | Slot | Offset | Bytes |
  // +=========================================================================+
  // | _initialized      | bool                        | 0    | 0      | 1     |
  // |-------------------+-----------------------------+------+--------+-------|
  // | _initializing     | bool                        | 0    | 1      | 1     |
  // |-------------------+-----------------------------+------+--------+-------|
  // | __gap             | uint256[50]                 | 1    | 0      | 1600  |
  // |-------------------+-----------------------------+------+--------+-------|
  // | _owner            | address                     | 51   | 0      | 20    |
  // |-------------------+-----------------------------+------+--------+-------|
  // | __gap             | uint256[49]                 | 52   | 0      | 1568  |
  // |-------------------+-----------------------------+------+--------+-------|
  // | updater           | address                     | 101  | 0      | 20    |
  // |-------------------+-----------------------------+------+--------+-------|
  // | state             | enum NomadBase.States       | 101  | 20     | 1     |
  // |-------------------+-----------------------------+------+--------+-------|
  // | committedRoot     | bytes32                     | 102  | 0      | 32    |
  // |-------------------+-----------------------------+------+--------+-------|
  // | __GAP             | uint256[47]                 | 103  | 0      | 1504  |
  // |-------------------+-----------------------------+------+--------+-------|
  // | remoteDomain      | uint32                      | 150  | 0      | 4     |
  // |-------------------+-----------------------------+------+--------+-------|
  // | optimisticSeconds | uint256                     | 151  | 0      | 32    |
  // |-------------------+-----------------------------+------+--------+-------|
  // | entered           | uint8                       | 152  | 0      | 1     |
  // |-------------------+-----------------------------+------+--------+-------|
  // | confirmAt         | mapping(bytes32 => uint256) | 153  | 0      | 32    |
  // |-------------------+-----------------------------+------+--------+-------|
  // | messages          | mapping(bytes32 => bytes32) | 154  | 0      | 32    |
  // |-------------------+-----------------------------+------+--------+-------|
  // | __GAP             | uint256[45]                 | 155  | 0      | 1440  |
  // +-------------------+-----------------------------+------+--------+-------+

  /// @notice Set the commited Root to  a deploye Replica, by manipulating storage
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
  }
}

contract UpgradeTest is LegacyFixture {
  function setUp() public override {
    super.setUp();
    uint32 domain = uint32(vm.envUint("NOMAD_DOMAIN"));
    assertEq(uint256(domain), uint256(replica.localDomain()));
    string memory domainName = vm.envString("NOMAD_DOMAIN_NAME");

    upgrade(domain, domainName);
    mockGovCalls();
  }

  event BeaconUpgraded(address, address);

  function mockGovCalls() public {
    console2.log("Mocking Gov calls to the Beacon Controller");
    beaconControllerContract = UpgradeBeaconController(beaconController);
    vm.startPrank(
      beaconControllerContract.owner(),
      beaconControllerContract.owner()
    );
    // Verify that the calldata from the previous step have been generated correctly
    (bool success, bytes memory _) = beaconController.call(upgradeHome);
    assertTrue(success);
    // Continue with contract calls (vs low-level call) because of improved ergonomics
    // i.e Forge can decode logs/traces
    beaconControllerContract.upgrade(replicaBeacon, address(newReplica));
    beaconControllerContract.upgrade(
      governanceRouterBeacon,
      address(newGovernanceRouter)
    );
    beaconControllerContract.upgrade(
      bridgeRouterBeacon,
      address(newBridgeRouter)
    );
    beaconControllerContract.upgrade(
      bridgeTokenBeacon,
      address(newBridgeToken)
    );
    beaconControllerContract.upgrade(
      tokenRegistryBeacon,
      address(newTokenRegistry)
    );
    vm.stopPrank();
    console2.log("The protocol has been upgraded");
    console2.log(unicode"♪┏(・o･)┛♪┗ ( ･o･) ┓♪");
  }

  function test_upgradedProveAlreadyProcessed() public {
    vm.expectRevert("already processed");
    replica.prove(legacyProcessLeaf, legacyProcessProof, legacyProcessIndex);
  }

  function test_legacyMessageStatusAfterUpgrade() public {
    bytes32 hash = keccak256(legacyProcessMessage);
    // Status is proccessed
    bytes32 status = "2";
    assertEq(replica.messages(hash), status);
  }

  function test_upgradedMessageStatus() public {
    assertTrue(replica.process(legacyProveMessage));
    bytes32 hash = keccak256(legacyProveMessage);
    // Status is proccessed
    bytes32 status = "2";
    assertEq(replica.messages(hash), status);
  }
}
