// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

/*//////////////////////////////////////////////////////////////
                                 IMPORTS
//////////////////////////////////////////////////////////////*/
// Core contracts
import { Replica } from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import { UpgradeBeaconController } from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";
import { Message } from "@nomad-xyz/contracts-core/contracts/libs/Message.sol";
// Solscript to Deploy Implementations
import { Upgrade } from "../Upgrade.sol";
// Utilities
import { MerkleTest } from "@nomad-xyz/contracts-core/contracts/test/utils/MerkleTest.sol";
import { GoodXappSimple } from "@nomad-xyz/contracts-core/contracts/test/utils/GoodXapps.sol";
import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";

contract LegacyFixture is Upgrade {
  // Proxy Addresses
  address replicaProxyAddress;
  address governanceRouterProxy;
  // TODO: test other contracts

  // Beacon Addresses
  // TODO: setup beacon in fork test command
  address homeBeacon;
  address replicaBeacon;
  address governanceRouterBeacon;
  address bridgeRouterBeacon;
  address tokenRegistryBeacon;
  address bridgeTokenBeacon;

  // Other Addresses
  address beaconController;

  // TEST VALUES
  // constants
  uint32 remoteDomain = 1500;

  // test contracts
  Replica replicaProxy;
  UpgradeBeaconController beaconControllerContract;
  GoodXappSimple goodXappSimple;
  MerkleTest merkleTest;

  // Legacy Message: proven
  bytes legacyProveMessage;
  bytes32 legacyProveRoot;
  bytes32 legacyProveLeaf;
  uint256 legacyProveIndex;
  bytes32[32] legacyProveProof;

  // Legacy Message: processed
  bytes legacyProcessMessage;
  bytes32 legacyProcessRoot;
  bytes32 legacyProcessLeaf;
  uint256 legacyProcessIndex;
  bytes32[32] legacyProcessProof;

  function setUp() public virtual {
    // load .env variables
    loadEnv();
    // setup test contracts
    replicaProxy = Replica(replicaProxyAddress);
    goodXappSimple = new GoodXappSimple();
    merkleTest = new MerkleTest();
    // perform first prove & process against legacy code
    legacyFirstProve();
    legacyFirstProcess();
  }

  function legacyFirstProve() public {
    // setup message info
    bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
    bytes32 receiver = bytes32(uint256(uint160(address(goodXappSimple))));
    uint32 nonce = 0;
    bytes memory messageBody = "legacyFirstProve";
    bytes memory message = Message.formatMessage(
      remoteDomain,
      sender,
      nonce,
      replicaProxy.localDomain(),
      receiver,
      messageBody
    );
    (
      bytes32 root,
      bytes32 leaf,
      uint256 index,
      bytes32[32] memory proof
    ) = merkleTest.getProof(message);
    // set storage vars with message info
    legacyProveRoot = root;
    legacyProveLeaf = leaf;
    legacyProveIndex = index;
    legacyProveProof = proof;
    legacyProveMessage = message;
    // prove the message
    setReplicaCommittedRoot(root);
    assertTrue(replicaProxy.prove(leaf, proof, index));
  }

  function legacyFirstProcess() public {
    // setup message info
    bytes32 sender = bytes32(uint256(uint160(vm.addr(134))));
    bytes32 receiver = bytes32(uint256(uint160(address(goodXappSimple))));
    uint32 nonce = 0;
    bytes memory messageBody = "legacyFirstProcess";
    bytes memory message = Message.formatMessage(
      remoteDomain,
      sender,
      nonce,
      replicaProxy.localDomain(),
      receiver,
      messageBody
    );
    (
      bytes32 root,
      bytes32 leaf,
      uint256 index,
      bytes32[32] memory proof
    ) = merkleTest.getProof(message);
    // set storage vars with message info
    legacyProcessRoot = root;
    legacyProcessLeaf = leaf;
    legacyProcessIndex = index;
    legacyProcessProof = proof;
    legacyProcessMessage = message;
    // prove and process the message
    setReplicaCommittedRoot(root);
    replicaProxy.proveAndProcess(message, proof, index);
  }

  function loadEnv() public {
    replicaProxyAddress = vm.envAddress("NOMAD_REPLICA_PROXY");
    governanceRouterProxy = vm.envAddress("NOMAD_GOV_ROUTER_PROXY");
    beaconController = vm.envAddress("NOMAD_BEACON_CONTROLLER");
    homeBeacon = vm.envAddress("NOMAD_HOME_BEACON");
    replicaBeacon = vm.envAddress("NOMAD_REPLICA_BEACON");
    governanceRouterBeacon = vm.envAddress("NOMAD_GOVERNANCE_ROUTER_BEACON");
    bridgeRouterBeacon = vm.envAddress("NOMAD_BRIDGE_ROUTER_BEACON");
    tokenRegistryBeacon = vm.envAddress("NOMAD_TOKEN_REGISTRY_BEACON");
    bridgeTokenBeacon = vm.envAddress("NOMAD_BRIDGE_TOKEN_BEACON");
    xAppConnectionManager = vm.envAddress("NOMAD_XAPP_CONNECTION_MANAGER");
    // require that addresses are non-zero
    require(replicaProxyAddress != address(0), "must set replica proxy");
    require(governanceRouterProxy != address(0), "must set governance proxy");
    require(beaconController != address(0), "must set beacon controller");
    require(homeBeacon != address(0), "must set home beacon");
    require(replicaBeacon != address(0), "must set replica beacon");
    require(
      governanceRouterBeacon != address(0),
      "must set governance router beacon"
    );
    require(bridgeRouterBeacon != address(0), "must set bridge router beacon");
    require(
      tokenRegistryBeacon != address(0),
      "must set token registry beacon"
    );
    require(bridgeTokenBeacon != address(0), "must set bridge token beacon");
    require(
      xAppConnectionManager != address(0),
      "must set xAppConnectionManager"
    );
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

  /// @notice Set the commited Root to a deployed Replica, by manipulating storage
  function setReplicaCommittedRoot(bytes32 root) public {
    bytes32 committedRootSlot = bytes32(uint256(102));
    bytes32 confirmAtStartSlot = keccak256(
      abi.encodePacked(root, bytes32(uint256(153)))
    );
    vm.store(address(replicaProxy), committedRootSlot, root);
    // How mappings are placed in storage
    // https://docs.soliditylang.org/en/v0.8.13/internals/layout_in_storage.html
    vm.store(address(replicaProxy), confirmAtStartSlot, bytes32(uint256(1)));
    assertEq(replicaProxy.committedRoot(), root);
    assertEq(replicaProxy.confirmAt(root), 1);
  }
}

contract UpgradeTest is LegacyFixture {
  function setUp() public override {
    super.setUp();
    uint32 domain = uint32(vm.envUint("NOMAD_DOMAIN"));
    assertEq(uint256(domain), uint256(replicaProxy.localDomain()));
    string memory domainName = vm.envString("NOMAD_DOMAIN_NAME");
    // deploy implementations
    deploy(domain, domainName);
    // perform upgrade calls
    upgrade();
  }

  function upgrade() public {
    console2.log(
      "Mocking Gov calls to the Beacon Controller to upgrade the implementations"
    );
    beaconControllerContract = UpgradeBeaconController(beaconController);
    vm.startPrank(
      beaconControllerContract.owner(),
      beaconControllerContract.owner()
    );
    // Home
    beaconControllerContract.upgrade(homeBeacon, address(home));
    // Replica
    beaconControllerContract.upgrade(replicaBeacon, address(replica));
    // GovernanceRouter
    beaconControllerContract.upgrade(
      governanceRouterBeacon,
      address(governanceRouter)
    );
    // BridgeRouter
    beaconControllerContract.upgrade(bridgeRouterBeacon, address(bridgeRouter));
    // BridgeToken
    beaconControllerContract.upgrade(bridgeTokenBeacon, address(bridgeToken));
    // TokenRegistry
    beaconControllerContract.upgrade(
      tokenRegistryBeacon,
      address(tokenRegistry)
    );
    vm.stopPrank();
    console2.log("The protocol has been upgraded");
    console2.log(unicode"♪┏(・o･)┛♪┗ ( ･o･) ┓♪");
  }

  // ALREADY PROCESSED MESSAGE: CAN'T BE PROCESSED

  function test_upgradedProveAlreadyProcessed() public {
    vm.expectRevert("already processed");
    replicaProxy.prove(
      legacyProcessLeaf,
      legacyProcessProof,
      legacyProcessIndex
    );
  }

  function test_upgradedProcessAlreadyProcessed() public {
    vm.expectRevert("!proven");
    replicaProxy.process(legacyProcessMessage);
  }

  function test_upgradedProveAndProcessAlreadyProcessed() public {
    vm.expectRevert("already processed");
    replicaProxy.proveAndProcess(
      legacyProcessMessage,
      legacyProcessProof,
      legacyProcessIndex
    );
  }

  // MESSAGE STATUS

  function test_legacyMessageStatusAfterUpgrade() public {
    bytes32 hash = keccak256(legacyProcessMessage);
    // Status is processed
    bytes32 status = bytes32(uint256(2));
    assertEq(status, replicaProxy.messages(hash));
  }

  function test_upgradedMessageStatus() public {
    // before process: status is 1
    bytes32 hash = keccak256(legacyProveMessage);
    bytes32 status = bytes32(uint256(1));
    assertEq(status, replicaProxy.messages(hash));
    // process succeeds
    assertTrue(replicaProxy.process(legacyProveMessage));
    // after process: status is 2
    status = bytes32(uint256(2));
    assertEq(status, replicaProxy.messages(hash));
  }
}
