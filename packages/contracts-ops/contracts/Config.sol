// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {UpgradeBeaconProxy} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconProxy.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";
import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";

import "forge-std/Vm.sol";
import "forge-std/Test.sol";

abstract contract Config {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    string internal config;

    struct Upgrade {
        UpgradeBeacon beacon;
        address implementation;
        UpgradeBeaconProxy proxy;
    }

    modifier onlyInitialized() {
        require(isInitialized(), "not initialized");
        _;
    }

    function __Config_initialize(string memory file) internal {
        require(!isInitialized(), "already init");
        config = vm.readFile(file);
    }

    function isInitialized() public view returns (bool) {
        return bytes(config).length != 0;
    }

    function corePath(string memory domain)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(".core.", domain));
    }

    function coreAttributePath(string memory domain, string memory key)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(corePath(domain), ".", key));
    }

    function loadCoreAttribute(string memory domain, string memory key)
        private
        returns (bytes memory)
    {
        return vm.parseJson(config, coreAttributePath(domain, key));
    }

    function coreDeployHeight(string memory domain)
        public
        onlyInitialized
        returns (uint256)
    {
        return abi.decode(loadCoreAttribute(domain, "deployHeight"), (uint256));
    }

    function governanceRouter(string memory domain)
        public
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(
                loadCoreAttribute(domain, "governanceRouter"),
                (Upgrade)
            );
    }

    function homeUpgrade(string memory domain)
        public
        onlyInitialized
        returns (Upgrade memory)
    {
        return abi.decode(loadCoreAttribute(domain, "home"), (Upgrade));
    }

    function home(string memory domain) public onlyInitialized returns (Home) {
        return Home(address(homeUpgrade(domain).proxy));
    }

    function updaterManager(string memory domain)
        public
        onlyInitialized
        returns (UpdaterManager)
    {
        return
            abi.decode(
                loadCoreAttribute(domain, "updaterManager"),
                (UpdaterManager)
            );
    }

    function upgradeBeaconController(string memory domain)
        public
        returns (UpgradeBeaconController)
    {
        return
            abi.decode(
                loadCoreAttribute(domain, "upgradeBeaconController"),
                (UpgradeBeaconController)
            );
    }

    function xAppconnectionManager(string memory domain)
        public
        returns (XAppConnectionManager)
    {
        return
            abi.decode(
                loadCoreAttribute(domain, "xAppconnectionManager"),
                (XAppConnectionManager)
            );
    }

    function replicaOfUpdgrade(string memory local, string memory replica)
        public
        returns (Upgrade memory)
    {
        string memory path = string(
            abi.encodePacked(corePath(local), ".replicas.", replica)
        );
        bytes memory res = vm.parseJson(config, path);
        return abi.decode(res, (Upgrade));
    }

    function replicaOf(string memory local, string memory replica)
        public
        returns (Replica)
    {
        return Replica(address(replicaOfUpdgrade(local, replica).proxy));
    }

    function networks() public returns (string[] memory) {
        return abi.decode(vm.parseJson(config, ".networks"), (string[]));
    }

    function bridgePath(string memory domain)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(".bridge.", domain));
    }

    function bridgeAttributePath(string memory domain, string memory key)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(bridgePath(domain), ".", key));
    }

    function loadBridgeAttribute(string memory domain, string memory key)
        private
        returns (bytes memory)
    {
        return vm.parseJson(config, bridgeAttributePath(domain, key));
    }

    function bridgeDeployHeight(string memory domain)
        public
        onlyInitialized
        returns (uint256)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "deployHeight"), (uint256));
    }

    function bridgeRouterUpgrade(string memory domain)
        public
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "bridgeRouter"), (Upgrade));
    }

    function bridgeTokenUpgrade(string memory domain)
        public
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "bridgeToken"), (Upgrade));
    }

    function tokenRegistryUpgrade(string memory domain)
        public
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "tokenRegistry"), (Upgrade));
    }

    function protocol(string memory domain) private returns (string memory) {
        string memory path = string(abi.encodePacked(".protocol.", domain));
        return string(vm.parseJson(config, path));
    }

    function protocolPath(string memory domain)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(".protocol.networks.", domain));
    }

    function protocolConfigPath(string memory domain)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(protocolPath(domain), ".configuration"));
    }

    function protocolAttributePath(string memory domain, string memory key)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(protocolPath(domain), ".", key));
    }

    function loadProtocolAttribute(string memory domain, string memory key)
        private
        returns (bytes memory)
    {
        return vm.parseJson(config, protocolAttributePath(domain, key));
    }

    function protocolConfigAttributePath(
        string memory domain,
        string memory key
    ) private pure returns (string memory) {
        return string(abi.encodePacked(protocolConfigPath(domain), ".", key));
    }

    function loadProtocolConfigAttribute(
        string memory domain,
        string memory key
    ) private returns (bytes memory) {
        return vm.parseJson(config, protocolConfigAttributePath(domain, key));
    }

    function connections(string memory domain)
        public
        onlyInitialized
        returns (string[] memory)
    {
        return
            abi.decode(
                loadProtocolAttribute(domain, "connections"),
                (string[])
            );
    }

    function domainNumber(string memory domain)
        public
        onlyInitialized
        returns (uint32)
    {
        return
            abi.decode(loadProtocolConfigAttribute(domain, "domain"), (uint32));
    }

    function updater(string memory domain)
        public
        onlyInitialized
        returns (address)
    {
        return
            abi.decode(
                loadProtocolConfigAttribute(domain, "updater"),
                (address)
            );
    }
}

contract TestJson is Test, Config {
    function setUp() public {
        // solhint-disable-next-line quotes
        config = '{"core": {"ethereum": {"deployHeight": 1234, "governanceRouter": {"proxy":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0","implementation":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0","beacon":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0"}}}}';
    }

    function test_Json() public {
        assertEq(coreDeployHeight("ethereum"), 1234);
        assertEq(
            address(governanceRouter("ethereum").proxy),
            0x569D80f7FC17316B4C83f072b92EF37B72819DE0
        );
    }
}
