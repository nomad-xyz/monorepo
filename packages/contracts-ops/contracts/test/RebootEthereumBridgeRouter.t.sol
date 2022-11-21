// // SPDX-License-Identifier: MIT OR Apache-2.0
// pragma solidity 0.7.6;
// pragma abicoder v2;

// import "forge-std/Test.sol";
// import {RebootTest} from "./Reboot.t.sol";
// import {NomadTest} from "@nomad-xyz/contracts-core/contracts/test/utils/NomadTest.sol";
// import {BridgeTestFixture} from "@nomad-xyz/contracts-bridge/contracts/test/utils/BridgeTest.sol";
// import {BridgeRouterBaseTest} from "@nomad-xyz/contracts-bridge/contracts/test/BridgeRouterBase.t.sol";
// import {EthereumBridgeRouterTest} from "@nomad-xyz/contracts-bridge/contracts/test/EthereumBridgeRouter.t.sol";
// import {EthereumBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/BridgeRouterHarness.sol";
// import {NFTRecoveryAccountantHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/NFTAccountantHarness.sol";
// import {IBridgeRouterHarness} from "@nomad-xyz/contracts-bridge/contracts/test/harness/IBridgeRouterHarness.sol";

// contract EthBridgeRouterRebootTest is RebootTest, EthereumBridgeRouterTest {
//     address bridgeRouterHarnessImpl;
//     address accountantHarnessImpl;
//     address fundsRecipient;

//     string constant ethereum = "ethereum";

//     function setUp() public override(EthereumBridgeRouterTest, NomadTest) {
//         BridgeTestFixture.setUp_testFixtures();

//         setUpReboot(1, "bridgerouter");
//         // TODO: live accountant?

//         // BridgeRouter
//         bridgeRouter = IBridgeRouterHarness(
//             address(getBridgeRouter(localDomainName))
//         );
//         accountant = NFTRecoveryAccountantHarness(
//             address(getAccountant(ethereum))
//         );

//         fundsRecipient = vm.addr(0x01189998819991197253);
//         // accountant must happen first so that bridgerouter connects to it
//         // right
//         setUp_upgradeAccountantHarness();
//         setUp_upgradeBridgeRouterHarness();
//     }

//     function setUp_upgradeBridgeRouterHarness() public {
//         bridgeRouterHarnessImpl = address(
//             new EthereumBridgeRouterHarness(address(getAccountant(ethereum)))
//         );
//         vm.writeJson(
//             vm.toString(bridgeRouterHarnessImpl),
//             outputPath,
//             bridgeAttributePath(ethereum, "bridgeRouter.implementation")
//         );
//         reloadConfig();
//         pushSingleUpgrade(bridgeRouterUpgrade(ethereum), ethereum);
//         prankExecuteRecoveryManager(
//             address(getGovernanceRouter(ethereum)),
//             getDomainNumber(ethereum)
//         );
//     }

//     function setUp_upgradeAccountantHarness() public {
//         accountantHarnessImpl = address(
//             new NFTRecoveryAccountantHarness(
//                 address(getBridgeRouter(ethereum)),
//                 fundsRecipient
//             )
//         );
//         vm.writeJson(
//             vm.toString(accountantHarnessImpl),
//             outputPath,
//             bridgeAttributePath(ethereum, "accountant.implementation")
//         );
//         reloadConfig();
//         pushSingleUpgrade(accountantUpgrade(ethereum), ethereum);
//         prankExecuteRecoveryManager(
//             address(getAccountant(ethereum)),
//             getDomainNumber(ethereum)
//         );
//     }
// }
