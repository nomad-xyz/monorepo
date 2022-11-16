// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import {RebootLogic} from "../scripts/Reboot.s.sol";

contract RebootTest is RebootLogic, Test {
    function setUp() public {}

    function test_setup() public {
        string memory _domain = "ethereum";
        string memory _configPath = "./actions/config.json";
        __Config_initialize(_configPath);
        __CallBatch_initialize(_domain, getDomainNumber(_domain), "", true);
        // perform reboot actions
        reboot(_domain);
        // execute governance actions via vm.prank
        prankExecuteRecoveryManager(
            address(getGovernanceRouter(_domain)),
            getDomainNumber(_domain)
        );
    }
}
