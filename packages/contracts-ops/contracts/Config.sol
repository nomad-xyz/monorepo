// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {UpgradeBeaconProxy} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconProxy.sol";
import {UpgradeBeacon} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeacon.sol";
import {UpgradeBeaconController} from "@nomad-xyz/contracts-core/contracts/upgrade/UpgradeBeaconController.sol";
import {UpdaterManager} from "@nomad-xyz/contracts-core/contracts/UpdaterManager.sol";
import {XAppConnectionManager} from "@nomad-xyz/contracts-core/contracts/XAppConnectionManager.sol";
import {Home} from "@nomad-xyz/contracts-core/contracts/Home.sol";
import {Replica} from "@nomad-xyz/contracts-core/contracts/Replica.sol";
import {GovernanceRouter} from "@nomad-xyz/contracts-core/contracts/governance/GovernanceRouter.sol";
import {BridgeRouter} from "@nomad-xyz/contracts-bridge/contracts/BridgeRouter.sol";
import {TokenRegistry} from "@nomad-xyz/contracts-bridge/contracts/TokenRegistry.sol";
import {ETHHelper} from "@nomad-xyz/contracts-bridge/contracts/ETHHelper.sol";
import {AllowListNFTRecoveryAccountant} from "@nomad-xyz/contracts-bridge/contracts/accountants/NFTAccountant.sol";

import "forge-std/Vm.sol";
import "forge-std/Test.sol";
import {INomadProtocol} from "./test/utils/NomadProtocol.sol";

abstract contract Config is INomadProtocol {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    string internal config;

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
        override
        onlyInitialized
        returns (GovernanceRouter)
    {
        return GovernanceRouter(address(governanceRouterUpgrade(domain).proxy));
    }

    function governanceRouterUpgrade(string memory domain)
        public
        override
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
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return abi.decode(loadCoreAttribute(domain, "home"), (Upgrade));
    }

    function home(string memory domain)
        public
        override
        onlyInitialized
        returns (Home)
    {
        return Home(address(homeUpgrade(domain).proxy));
    }

    function updaterManager(string memory domain)
        public
        override
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
        override
        returns (UpgradeBeaconController)
    {
        return
            abi.decode(
                loadCoreAttribute(domain, "upgradeBeaconController"),
                (UpgradeBeaconController)
            );
    }

    function xAppConnectionManager(string memory domain)
        public
        override
        returns (XAppConnectionManager)
    {
        return
            abi.decode(
                loadCoreAttribute(domain, "xAppconnectionManager"),
                (XAppConnectionManager)
            );
    }

    function replicaOfUpgrade(string memory local, string memory remote)
        public
        override
        returns (Upgrade memory)
    {
        string memory path = string(
            abi.encodePacked(corePath(local), ".replicas.", remote)
        );
        bytes memory res = vm.parseJson(config, path);
        return abi.decode(res, (Upgrade));
    }

    function replicaOf(string memory local, string memory remote)
        public
        override
        returns (Replica)
    {
        return Replica(address(replicaOfUpgrade(local, remote).proxy));
    }

    function networks() public override returns (string[] memory) {
        return abi.decode(vm.parseJson(config, ".networks"), (string[]));
    }

    function governor() public override returns (address) {
        return
            abi.decode(
                vm.parseJson(config, ".protocol.governor.id"),
                (address)
            );
    }

    function governorDomain() public override returns (uint256) {
        return
            abi.decode(
                vm.parseJson(config, ".protocol.governor.domain"),
                (uint256)
            );
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

    function bridgeRouter(string memory domain)
        public
        override
        onlyInitialized
        returns (BridgeRouter)
    {
        return BridgeRouter(address(bridgeRouterUpgrade(domain).proxy));
    }

    function bridgeRouterUpgrade(string memory domain)
        public
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "bridgeRouter"), (Upgrade));
    }

    function bridgeTokenUpgrade(string memory domain)
        public
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "bridgeToken"), (Upgrade));
    }

    function tokenRegistry(string memory domain)
        public
        override
        onlyInitialized
        returns (TokenRegistry)
    {
        return TokenRegistry(address(tokenRegistryUpgrade(domain).proxy));
    }

    function tokenRegistryUpgrade(string memory domain)
        public
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "tokenRegistry"), (Upgrade));
    }

    function accountant(string memory domain)
        public
        override
        onlyInitialized
        returns (AllowListNFTRecoveryAccountant)
    {
        return
            AllowListNFTRecoveryAccountant(
                address(accountantUpgrade(domain).proxy)
            );
    }

    function accountantUpgrade(string memory domain)
        public
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return abi.decode(loadBridgeAttribute(domain, "accountant"), (Upgrade));
    }

    function ethHelper(string memory domain)
        public
        override
        returns (ETHHelper)
    {
        return abi.decode(loadCoreAttribute(domain, "ethHelper"), (ETHHelper));
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
        override
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
        override
        onlyInitialized
        returns (address)
    {
        return
            abi.decode(
                loadProtocolConfigAttribute(domain, "updater"),
                (address)
            );
    }

    function recoveryManager(string memory domain)
        public
        override
        onlyInitialized
        returns (address)
    {
        return
            abi.decode(
                loadProtocolConfigAttribute(
                    domain,
                    "governance.recoveryManager"
                ),
                (address)
            );
    }

    function watchers(string memory domain)
        public
        override
        onlyInitialized
        returns (address[] memory)
    {
        return
            abi.decode(
                loadProtocolConfigAttribute(domain, "watchers"),
                (address[])
            );
    }

    function recoveryTimelock(string memory domain)
        public
        override
        onlyInitialized
        returns (uint256)
    {
        return
            abi.decode(
                loadProtocolConfigAttribute(
                    domain,
                    "governance.recoveryTimelock"
                ),
                (uint256)
            );
    }

    function optimisticSeconds(string memory domain)
        public
        override
        onlyInitialized
        returns (uint256)
    {
        return
            abi.decode(
                loadProtocolConfigAttribute(domain, "optimisticSeconds"),
                (uint256)
            );
    }
}

contract TestJson is Test, Config {
    function setUp() public {
        // solhint-disable-next-line quotes
        config = '{ "networks": ["avalanche", "ethereum"], "protocol": {"governor": {"domain": 6648936, "id": "0x93277b8f5939975b9e6694d5fd2837143afbf68a"}}, "core": {"ethereum": {"deployHeight": 1234, "governanceRouter": {"proxy":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0","implementation":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0","beacon":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0"}}}}';
    }

    function test_Json() public {
        assertEq(networks()[0], "avalanche");
        assertEq(governor(), 0x93277b8f5939975b9E6694d5Fd2837143afBf68A);
        assertEq(coreDeployHeight("ethereum"), 1234);
        assertEq(
            address(governanceRouter("ethereum")),
            0x569D80f7FC17316B4C83f072b92EF37B72819DE0
        );
    }
}
