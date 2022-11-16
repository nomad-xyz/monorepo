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
import {INomadProtocol} from "./test/utils/INomadProtocol.sol";

import "forge-std/Vm.sol";
import "forge-std/Test.sol";

abstract contract Config is INomadProtocol {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    string internal inputPath;
    string internal outputPath;
    string internal config;

    modifier onlyInitialized() {
        require(isInitialized(), "not initialized");
        _;
    }

    function __Config_initialize(string memory _fileName) internal {
        require(!isInitialized(), "already init");
        inputPath = string(abi.encodePacked("./actions/", _fileName));
        _readConfig(inputPath);
        // copy input config to output path
        // NOTE: will overwrite any existing contents of output file
        outputPath = string(abi.encodePacked("./actions/output-", _fileName));
        vm.writeFile(outputPath, config);
    }

    function reloadConfig() internal {
        _readConfig(outputPath);
    }

    function _readConfig(string memory _path) private {
        config = vm.readFile(_path);
        require(
            bytes(config).length != 0,
            string(abi.encodePacked("empty config ", _path))
        );
    }

    function isInitialized() public view returns (bool) {
        return bytes(config).length != 0;
    }

    function domainError(string memory message, string memory domain)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(message, domain));
    }

    function corePath(string memory domain)
        private
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(".core.", domain));
    }

    function coreAttributePath(string memory domain, string memory key)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(corePath(domain), ".", key));
    }

    function loadCoreAttribute(string memory domain, string memory key)
        private
        view
        returns (bytes memory)
    {
        return vm.parseJson(config, coreAttributePath(domain, key));
    }

    function getCoreDeployHeight(string memory domain)
        public
        view
        onlyInitialized
        returns (uint256)
    {
        return abi.decode(loadCoreAttribute(domain, "deployHeight"), (uint256));
    }

    function governanceRouterUpgrade(string memory domain)
        public
        view
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

    function getGovernanceRouter(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (GovernanceRouter)
    {
        return GovernanceRouter(address(governanceRouterUpgrade(domain).proxy));
    }

    function homeUpgrade(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return abi.decode(loadCoreAttribute(domain, "home"), (Upgrade));
    }

    function getHome(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (Home)
    {
        return Home(address(homeUpgrade(domain).proxy));
    }

    function getHomeImpl(string memory domain)
        public
        view
        onlyInitialized
        returns (Home)
    {
        return Home(address(homeUpgrade(domain).implementation));
    }

    function getUpdaterManager(string memory domain)
        public
        view
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

    function getUpgradeBeaconController(string memory domain)
        public
        view
        override
        returns (UpgradeBeaconController)
    {
        return
            abi.decode(
                loadCoreAttribute(domain, "upgradeBeaconController"),
                (UpgradeBeaconController)
            );
    }

    function getXAppConnectionManager(string memory domain)
        public
        view
        override
        returns (XAppConnectionManager)
    {
        return
            abi.decode(
                loadCoreAttribute(domain, "xAppConnectionManager"),
                (XAppConnectionManager)
            );
    }

    function replicaOfPath(string memory local, string memory remote)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(corePath(local), ".replicas.", remote));
    }

    function replicaOfUpgrade(string memory local, string memory remote)
        public
        view
        override
        returns (Upgrade memory)
    {
        return
            abi.decode(
                vm.parseJson(config, replicaOfPath(local, remote)),
                (Upgrade)
            );
    }

    function getReplicaOf(string memory local, string memory remote)
        public
        view
        override
        returns (Replica)
    {
        return Replica(address(replicaOfUpgrade(local, remote).proxy));
    }

    function getNetworks() public view override returns (string[] memory) {
        return abi.decode(vm.parseJson(config, ".networks"), (string[]));
    }

    function getRpcs(string memory domain)
        public
        view
        returns (string[] memory)
    {
        string memory key = string(abi.encodePacked(".rpcs.", domain));
        return abi.decode(vm.parseJson(config, key), (string[]));
    }

    function getGovernor() public view override returns (address) {
        return
            abi.decode(
                vm.parseJson(config, ".protocol.governor.id"),
                (address)
            );
    }

    function getGovernorDomain() public view override returns (uint256) {
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
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(bridgePath(domain), ".", key));
    }

    function loadBridgeAttribute(string memory domain, string memory key)
        private
        view
        returns (bytes memory)
    {
        return vm.parseJson(config, bridgeAttributePath(domain, key));
    }

    function getBridgeDeployHeight(string memory domain)
        public
        view
        onlyInitialized
        returns (uint256)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "deployHeight"), (uint256));
    }

    function bridgeRouterUpgrade(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "bridgeRouter"), (Upgrade));
    }

    function getBridgeRouter(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (BridgeRouter)
    {
        return BridgeRouter(address(bridgeRouterUpgrade(domain).proxy));
    }

    function bridgeTokenUpgrade(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "bridgeToken"), (Upgrade));
    }

    function tokenRegistryUpgrade(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (Upgrade memory)
    {
        return
            abi.decode(loadBridgeAttribute(domain, "tokenRegistry"), (Upgrade));
    }

    function getTokenRegistry(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (TokenRegistry)
    {
        return TokenRegistry(address(tokenRegistryUpgrade(domain).proxy));
    }

    function accountantUpgrade(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (Upgrade memory _acctUpgrade)
    {
        bytes memory raw = loadBridgeAttribute(domain, "accountant");
        // if accountant exists, decode & return
        if (raw.length != 0) {
            _acctUpgrade = abi.decode(raw, (Upgrade));
        }
        // if accountant doesn't exist, an empty upgrade setup will be returned
        // user can check if setup == address(0) to check if accountant is present
    }

    function getAccountant(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (AllowListNFTRecoveryAccountant)
    {
        return
            AllowListNFTRecoveryAccountant(
                address(accountantUpgrade(domain).proxy)
            );
    }

    function getEthHelper(string memory domain)
        public
        view
        override
        returns (ETHHelper)
    {
        bytes memory raw = loadCoreAttribute(domain, "ethHelper");
        require(raw.length != 0, domainError("no ethHelper for ", domain));
        return abi.decode(raw, (ETHHelper));
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

    function bridgeConfigPath(string memory domain)
        private
        pure
        returns (string memory)
    {
        return
            string(
                abi.encodePacked(protocolPath(domain), ".bridgeConfiguration")
            );
    }

    function protocolAttributePath(string memory domain, string memory key)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(protocolPath(domain), ".", key));
    }

    function loadProtocolAttribute(string memory domain, string memory key)
        internal
        view
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
    ) internal view returns (bytes memory) {
        return vm.parseJson(config, protocolConfigAttributePath(domain, key));
    }

    function accountantConfigAttributePath(
        string memory domain,
        string memory key
    ) private pure returns (string memory) {
        return
            string(
                abi.encodePacked(bridgeConfigPath(domain), ".accountant.", key)
            );
    }

    function loadAccountantConfigAttribute(
        string memory domain,
        string memory key
    ) private view returns (bytes memory) {
        return vm.parseJson(config, accountantConfigAttributePath(domain, key));
    }

    function getConnections(string memory domain)
        public
        view
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

    function getDomainNumber(string memory domain)
        public
        view
        onlyInitialized
        returns (uint32)
    {
        return abi.decode(loadProtocolAttribute(domain, "domain"), (uint32));
    }

    function getUpdater(string memory domain)
        public
        view
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

    function getRecoveryManager(string memory domain)
        public
        view
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

    function getWatchers(string memory domain)
        public
        view
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

    function getRecoveryTimelock(string memory domain)
        public
        view
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

    function getOptimisticSeconds(string memory domain)
        public
        view
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

    function getFundsRecipient(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (address)
    {
        return
            abi.decode(
                loadAccountantConfigAttribute(domain, "fundsRecipient"),
                (address)
            );
    }

    function getAccountantOwner(string memory domain)
        public
        view
        override
        onlyInitialized
        returns (address)
    {
        return
            abi.decode(
                loadAccountantConfigAttribute(domain, "owner"),
                (address)
            );
    }
}

contract TestJson is Test, Config {
    function setUp() public {
        // solhint-disable-next-line quotes
        config = '{ "networks": ["avalanche", "ethereum"], "protocol": { "networks": { "avalanche": { "bridgeConfiguration": { "accountant": { "owner": "0x0000011111222223333344444555557777799999" }}}}, "governor": {"domain": 6648936, "id": "0x93277b8f5939975b9e6694d5fd2837143afbf68a"}}, "core": {"ethereum": {"deployHeight": 1234, "governanceRouter": {"proxy":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0","implementation":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0","beacon":"0x569D80f7FC17316B4C83f072b92EF37B72819DE0"}, "ethHelper": "0x999d80F7FC17316b4c83f072b92EF37b72718De0"}}}';
    }

    function test_Json() public {
        assertEq(
            address(getEthHelper("ethereum")),
            0x999d80F7FC17316b4c83f072b92EF37b72718De0
        );
        vm.expectRevert("no ethHelper for randomDomain");
        getEthHelper("randomDomain");
        assertEq(getNetworks()[0], "avalanche");
        assertEq(
            getFundsRecipient("avalanche"),
            0x0000011111222223333344444555557777799999
        );
        assertEq(getGovernor(), 0x93277b8f5939975b9E6694d5Fd2837143afBf68A);
        assertEq(getCoreDeployHeight("ethereum"), 1234);
        assertEq(
            address(getGovernanceRouter("ethereum")),
            0x569D80f7FC17316B4C83f072b92EF37B72819DE0
        );
    }
}
