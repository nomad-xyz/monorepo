// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import {RebootLogic} from "../scripts/Reboot.s.sol";
import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";

contract RebootTest is RebootLogic, NomadTest {
    string remote;
    string constant _domain = "ethereum";

    function setUpReboot(string memory testName) public {
        // ALL
        vm.createSelectFork(vm.envString("RPC_URL"), 15_977_624);
        // read fresh config from config.json and write it to a test-specific file
        // so that state from each test don't collide
        // NOTE: this is super messy.. it would be better if modifications were stored to memory within the test run
        // rather than a file which can be read / written by other tests
        string memory _configName = string(
            abi.encodePacked("config-", testName, ".json")
        );
        string memory _path = string(
            abi.encodePacked("./actions/", _configName)
        );
        vm.writeFile(_path, vm.readFile("./actions/config.json"));
        __Config_initialize(_configName);
        // init fresh callbatch
        __CallBatch_initialize(_domain, getDomainNumber(_domain), "", true);
        // call base setup
        super.setUp();
        // set fake updater for ethereum & 1 remote chain
        // before updater rotation, so it will be rotated on-chain
        vm.writeJson(
            vm.toString(updaterAddr),
            outputPath,
            protocolAttributePath(remote, "updater")
        );
        reloadConfig();
        // perform reboot actions
        reboot(localDomainName);
        // execute governance actions via vm.prank
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(localDomainName)),
            getDomainNumber(localDomainName)
        );
        // basic vars
        remote = getConnections(localDomainName)[0];
        remoteDomain = getDomainNumber(remote);
        homeDomain = getDomainNumber(localDomainName);
    }
}
