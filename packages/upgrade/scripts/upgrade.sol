// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;


import { Home } from "../../contracts-core/contracts/Home.sol";
import { Replica } from "../../contracts-core/contracts/Replica.sol";
import { XAppConnectionManager } from "../../contracts-core/contracts/XAppConnectionManager.sol";
import { GovernanceMessage } from "../../contracts-core/contracts/governance/GovernanceMessage.sol";
import { console2 } from "forge-std/console2.sol";
import { NomadConstants } from "./NomadConstants.sol";

contract UpgradeNomad {


    /*//////////////////////////////////////////////////////////////
                            UPGRADE ARGUMENTS
    //////////////////////////////////////////////////////////////*/

   uint32 domain;


    /*//////////////////////////////////////////////////////////////
                          DEPLOYMENT CONTRACTS
    //////////////////////////////////////////////////////////////*/

    Home newHome;
    Replica newReplica;
    GovernanceRouter newGovernanceRouter;
    BridgeRouter newBridgeRouter;
    TokenRegistry newTokenRegistry;
    BridgeToken newBridgeToken;

    function upgrade(uint32 _domain) public {
        domain = _domain;
        console2.log("Upgrading Contracts on domain ", NomadConstants.domIntToStr(domain));
        console2.log("RPC endpoint: ", vm.envString("NOMAD_ACTIVE_RPC_ENDPOINT"));
        deploy_implementations();
    }


    function deploy_implementations() public {
        console2.log("Creating new implementations...");
        string memory localVar;
        string memory systemVar;
        string memory contractName;
        contractName = "Home";
        temp = contractToEnvVar(contractName);
        systemVar = vm.envAddress(temp);
        if ( systemVar == address(0)){
            newHome = new Home();
            setAddressEnvVariable(temp, address(home));
        } else {
            console2.log(temp, " detected. Skipping deployment for this contract..");
            newHome = Home(systemVar);
        }
        contractName = "GovernanceRouter";
        temp = contractToEnvVar(contractName);
        systemVar = vm.envAddress(temp);
        if ( systemVar == address(0)){
            governanceRouter = new GovernanceRouter();
            setAddressEnvVariable(temp, address(governanceRouter));
        } else {
            console2.log(temp, " detected. Skipping deployment for this contract..");
            governanceRouter = GovernanceRouter(systemVar);
        }
        contractName = "BridgeRouter";
        temp = contractToEnvVar(contractName);
        systemVar = vm.envAddress(temp);
        if ( systemVar == address(0)){
            bridgeRouter = new BridgeRouter();
            setAddressEnvVariable(temp, address(bridgeRouter));
        } else {
            console2.log(temp, " detected. Skipping deployment for this contract..");
            bridgeRouter = BridgeRouter(systemVar);
        }
        contractName = "TokenRegistry";
        temp = contractToEnvVar(contractName);
        systemVar = vm.envAddress(temp);
        if ( systemVar == address(0)){
            tokenRegistry = new TokenRegistry();
            setAddressEnvVariable(temp, address(tokenRegistry));
        } else {
            console2.log(temp, " detected. Skipping deployment for this contract..");
            tokenRegistry = TokenRegistry(systemVar);
        }
        contractName = "BridgeToken";
        temp = contractToEnvVar(contractName);
        systemVar = vm.envAddress(temp);
        if ( systemVar == address(0)){
            bridgeToken = new BridgeToken();
            setAddressEnvVariable(temp, address(bridgeToken))
        } else {
            console2.log(temp, " detected. Skipping deployment for this contract..");
            bridgeToken = BridgeToken(systemVar);
        }
    }

    function governance_actions() public {



    }

    /*//////////////////////////////////////////////////////////////
                            UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/


    function contractToEnvVar(string memory name) private returns (string memory){
        bytes memory data;
        data = abi.encodePacked('NOMAD_', domainToString(domain), '_', name);
        return abi.decode(data, string);
    }

    function setAddressEnvVariable(string memory name, address addr) private {
        bytes memory data = abi.encodePacked(data, toHexString(uin256(uint160(addr))));
        vm.setEnv(name, abi.decode(data, string));
    }

    function domainToString(uint32 domain) private pure returns (string memory){

    }

    function toHexString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    function toHexString(uint256 value, uint256 length) private pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }

}
