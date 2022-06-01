import { NomadConfig } from '@nomad-xyz/configuration';

export const devConfig: NomadConfig = {
    "version": 0,
    "environment": "development",
    "networks": [
      "goerli",
      "rinkeby",
      "evmostestnet",
      "kovan"
    ],
    "rpcs": {
      "rinkeby": [
        "https://rinkeby-light.eth.linkpool.io"
      ],
      "goerli": [
        "https://goerli-light.eth.linkpool.io"
      ],
      "kovan": [
        "https://kovan.poa.network"
      ],
      "evmostestnet": [
        "https://eth.bd.evmos.dev:8545"
      ]
    },
    "protocol": {
      "governor": {
        "domain": 1001,
        "id": "0xa4849f1d96b26066f9c631fcdc8f1457d27fb5ec"
      },
      "networks": {
        "kovan": {
          "name": "kovan",
          "domain": 2001,
          "connections": [
            "rinkeby",
            "neontestnet",
            "evmostestnet",
            "goerli"
          ],
          "configuration": {
            "optimisticSeconds": 10,
            "processGas": 850000,
            "reserveGas": 15000,
            "maximumGas": 1000000,
            "updater": "0x45818549c1e7d16c915fe23c1524b524507a184b",
            "watchers": [
              "0xe8c6bf61d5f5744f465865772e1de88059267bac"
            ],
            "governance": {
              "recoveryManager": "0xa4849f1d96b26066f9c631fcdc8f1457d27fb5ec",
              "recoveryTimelock": 180
            }
          },
          "specs": {
            "chainId": 42,
            "blockTime": 4,
            "finalizationBlocks": 10,
            "supports1559": false,
            "confirmations": 15,
            "blockExplorer": "https://kovan.etherscan.io/",
            "indexPageSize": 2000
          },
          "bridgeConfiguration": {
            "weth": "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
            "customs": [],
            "mintGas": 200000,
            "deployGas": 850000
          }
        },
        "goerli": {
          "name": "goerli",
          "domain": 3001,
          "connections": [
            "neontestnet",
            "evmostestnet",
            "kovan",
            "rinkeby"
          ],
          "configuration": {
            "optimisticSeconds": 10,
            "processGas": 850000,
            "reserveGas": 15000,
            "maximumGas": 1000000,
            "updater": "0xd16bdbbc56090156ec609ebebc8bace1240fa22e",
            "watchers": [
              "0x69520f1cec6199fe93c6c77881b5de701e0efeff"
            ],
            "governance": {
              "recoveryManager": "0xa4849f1d96b26066f9c631fcdc8f1457d27fb5ec",
              "recoveryTimelock": 180
            }
          },
          "specs": {
            "chainId": 5,
            "blockTime": 15,
            "finalizationBlocks": 100,
            "supports1559": true,
            "confirmations": 4,
            "blockExplorer": "https://goerli.etherscan.io/",
            "indexPageSize": 2000
          },
          "bridgeConfiguration": {
            "weth": "0x0bb7509324ce409f7bbc4b701f932eaca9736ab7",
            "customs": [],
            "mintGas": 200000,
            "deployGas": 850000
          }
        },
        "evmostestnet": {
          "name": "evmostestnet",
          "domain": 4001,
          "connections": [
            "neontestnet",
            "kovan",
            "rinkeby",
            "goerli"
          ],
          "configuration": {
            "optimisticSeconds": 10,
            "processGas": 850000,
            "reserveGas": 15000,
            "maximumGas": 1000000,
            "updater": "0x815d2281a9ebacfbffa4294375de6e14f2522d87",
            "watchers": [
              "0xafcf8db79e999cb79260572fb61c8e5006b855a4"
            ],
            "governance": {
              "recoveryManager": "0xa4849f1d96b26066f9c631fcdc8f1457d27fb5ec",
              "recoveryTimelock": 180
            }
          },
          "specs": {
            "chainId": 9000,
            "blockTime": 5,
            "finalizationBlocks": 10,
            "supports1559": false,
            "confirmations": 6,
            "blockExplorer": "https://evm.evmos.dev/",
            "indexPageSize": 2000
          },
          "bridgeConfiguration": {
            "weth": "0xcc491f589b45d4a3c679016195b3fb87d7848210",
            "customs": [],
            "mintGas": 200000,
            "deployGas": 850000
          }
        },
        "rinkeby": {
          "name": "rinkeby",
          "domain": 1001,
          "connections": [
            "kovan",
            "evmostestnet",
            "neontestnet",
            "goerli"
          ],
          "configuration": {
            "optimisticSeconds": 10,
            "processGas": 850000,
            "reserveGas": 15000,
            "maximumGas": 1000000,
            "updater": "0xe80d5d65275208aee8e10609258e4e048eb86b4c",
            "watchers": [
              "0x8ad65ba028cae9e3932959d5c167a09ede941d2c"
            ],
            "governance": {
              "recoveryManager": "0xa4849f1d96b26066f9c631fcdc8f1457d27fb5ec",
              "recoveryTimelock": 180
            }
          },
          "specs": {
            "chainId": 4,
            "blockTime": 15,
            "finalizationBlocks": 80,
            "supports1559": true,
            "confirmations": 4,
            "blockExplorer": "https://rinkeby.etherscan.io/",
            "indexPageSize": 2000
          },
          "bridgeConfiguration": {
            "weth": "0xc778417e063141139fce010982780140aa0cd5ab",
            "customs": [],
            "mintGas": 200000,
            "deployGas": 850000
          }
        }
      }
    },
    "core": {
      "goerli": {
        "deployHeight": 6748555,
        "upgradeBeaconController": "0x5bba73ef76bf303c0b48ade5d611bb2f80471653",
        "xAppConnectionManager": "0x859943879f79ce8d2e9e1d8c848c7ce9f6eb63d8",
        "updaterManager": "0x75bd8ab02238dca52f303013f038d4e2d834e8fc",
        "governanceRouter": {
          "implementation": "0x79ea0091b38cb6a95bef2ae3bdbf28af49ba1c28",
          "proxy": "0x66d093d20b3dd088397695c65df980c014da5e3e",
          "beacon": "0xaabd0850ab63a1e856521b900b40b496a99e8560"
        },
        "home": {
          "implementation": "0x0ef8ad9603f15127916e2d4777453ac885ae4669",
          "proxy": "0x454f1ec431470063a1792ead14c1f10876796e5f",
          "beacon": "0x25ec670059754b859fdcbdb6802c7644fd0a1af5"
        },
        "replicas": {
          "kovan": {
            "implementation": "0x8a36fbccc8d844aaacbca71e7ec8847215bb82f2",
            "proxy": "0x9df21c4a016b8bd84000b29a3ba51980ddd7b37a",
            "beacon": "0x4a455cbabd96dc9b0dba2f0ccbb58a2dad403df2"
          },
          "rinkeby": {
            "implementation": "0x8a36fbccc8d844aaacbca71e7ec8847215bb82f2",
            "proxy": "0xf405c58d95a8f2617505841bdacef6de27006d74",
            "beacon": "0x4a455cbabd96dc9b0dba2f0ccbb58a2dad403df2"
          },
          "evmostestnet": {
            "implementation": "0x8a36fbccc8d844aaacbca71e7ec8847215bb82f2",
            "proxy": "0xf1b83d100860887aef35e50b3794e28dc744e5ce",
            "beacon": "0x4a455cbabd96dc9b0dba2f0ccbb58a2dad403df2"
          }
        }
      },
      "kovan": {
        "deployHeight": 31134284,
        "upgradeBeaconController": "0xb0aefe5a88eeda7af7171c57430b153251275c33",
        "xAppConnectionManager": "0x5240cc5f271f6dcbcc5ec67be04fd9de0f50f91f",
        "updaterManager": "0x8bd3e4b2ef10491fcc9153840a8ca54c7e7738bf",
        "governanceRouter": {
          "implementation": "0xf4a442eeecc3e275d5ed4d91ec6231c7ab8e2386",
          "proxy": "0x3f7754a3e178acc32ff8d5887b38f4e7b1673d8b",
          "beacon": "0xd3bd51f18b7a77f2d16364ec0e7a8e499f86c8e9"
        },
        "home": {
          "implementation": "0x397a0edbdd4c89d1dad557ae5bac75f585d77b7d",
          "proxy": "0x4730144aa70a22bd04338e4589ec8f55618e73bf",
          "beacon": "0x1c29678a918b8b4823a76b542b199b82cf4629ba"
        },
        "replicas": {
          "evmostestnet": {
            "implementation": "0x18f4019f6620e1593059b5a0518ceed6a6634373",
            "proxy": "0x5dcbdfe40ef9e865b3cc2c90c517c557b2fa91c8",
            "beacon": "0x6c6b091665520088dbfe8ccb1ecb1d0556814e0d"
          },
          "rinkeby": {
            "implementation": "0x18f4019f6620e1593059b5a0518ceed6a6634373",
            "proxy": "0x523c830c9007b595609a7e5f4885eeae6a4d2318",
            "beacon": "0x6c6b091665520088dbfe8ccb1ecb1d0556814e0d"
          },
          "goerli": {
            "implementation": "0x18f4019f6620e1593059b5a0518ceed6a6634373",
            "proxy": "0x9969e1b2a9f81fc9066897b4865b58443967024b",
            "beacon": "0x6c6b091665520088dbfe8ccb1ecb1d0556814e0d"
          }
        }
      },
      "evmostestnet": {
        "deployHeight": 942883,
        "upgradeBeaconController": "0xbe288f49557a2e70bc54840c5a96e84747aa9431",
        "xAppConnectionManager": "0x224f3558770ad0740ed94bbdea79e197e51852bd",
        "updaterManager": "0x9095f216b9cb3f1da981062ec81114a2c7494cd4",
        "governanceRouter": {
          "implementation": "0x56c4c4eb8901fd25a37224cef34c92301f182f47",
          "proxy": "0x505d0ffb3cb00738338045b88d9a995e2f427017",
          "beacon": "0x6d7c1abe3dc804a69d7c96ba34edea3a8b9c4826"
        },
        "home": {
          "implementation": "0x326cb118da8d26f04758db280705094292eac18c",
          "proxy": "0x198740c6fc71308b2f97fe5d632ab46890bcb177",
          "beacon": "0x3fbcb5d882d706c9dea852700c7c35d1087d8740"
        },
        "replicas": {
          "goerli": {
            "implementation": "0x67e9837aa16f425b379aaf7e4d5581e59d577cf2",
            "proxy": "0xff1000469744aa20630ae61d5f9f461b08755582",
            "beacon": "0xa38bdbd738e81a93e006959f1ea6565bb033c8d7"
          },
          "rinkeby": {
            "implementation": "0x67e9837aa16f425b379aaf7e4d5581e59d577cf2",
            "proxy": "0x362f6d97609501e630ad8a5da2f211675cac591e",
            "beacon": "0xa38bdbd738e81a93e006959f1ea6565bb033c8d7"
          },
          "kovan": {
            "implementation": "0x67e9837aa16f425b379aaf7e4d5581e59d577cf2",
            "proxy": "0x745f85d60c6afe77a6465336b87f4baaa5418a13",
            "beacon": "0xa38bdbd738e81a93e006959f1ea6565bb033c8d7"
          }
        }
      },
      "rinkeby": {
        "deployHeight": 10537248,
        "upgradeBeaconController": "0xffc73f39f22ebfbe4643c7abcd972edc62bfb371",
        "xAppConnectionManager": "0xb26806b76540348d655a12a5b8427ee088459625",
        "updaterManager": "0xd7191ef96218836fd73f58c7579e88062e162321",
        "governanceRouter": {
          "implementation": "0xebedb3243a24a940f086de8cadc96883df56e9de",
          "proxy": "0xfbb2fec4fcb5738c739b9705e723117581cbabeb",
          "beacon": "0x0574d16015f9eef1d228c3c02d551ca8a7458036"
        },
        "home": {
          "implementation": "0x87787132ad6282c156ed3e3aaeebbfbc35728f15",
          "proxy": "0x0977fc99b94fd769ea4fbbfa14777434f773ced2",
          "beacon": "0x8c49b91b307cd9d00838b947cf7f4a25bc051152"
        },
        "replicas": {
          "goerli": {
            "implementation": "0xad74bef73458ddb8646af7a2e9a56734fa44694c",
            "proxy": "0x96ee295d2c96ea0353b25ff0b8e8e0b8e64db60f",
            "beacon": "0x8dc1c77718b6f97f4a1e06e234ba2c8defd9cf9a"
          },
          "kovan": {
            "implementation": "0xad74bef73458ddb8646af7a2e9a56734fa44694c",
            "proxy": "0x097a3eb6cd351ab28de67a0a0bda9e0e32733da7",
            "beacon": "0x8dc1c77718b6f97f4a1e06e234ba2c8defd9cf9a"
          },
          "evmostestnet": {
            "implementation": "0xad74bef73458ddb8646af7a2e9a56734fa44694c",
            "proxy": "0x423b1eced988959067834b13b501c8ab78a28576",
            "beacon": "0x8dc1c77718b6f97f4a1e06e234ba2c8defd9cf9a"
          }
        }
      },
    },
    "bridge": {
      "rinkeby": {
        "deployHeight": 10537318,
        "bridgeRouter": {
          "implementation": "0x4e103edd1971e2721105a1cb090d81821b70aa1e",
          "proxy": "0x5731f3581d139e9a697448a34f55a89b781aac9a",
          "beacon": "0xa778962b0ffbe7bc4449c308513a196bfa344232"
        },
        "tokenRegistry": {
          "implementation": "0x2b91b5ce301bfc7b42927f40f9cef10b0c64f2f4",
          "proxy": "0x7975a69a1fbccd03693e1ebec3e494be09d0604a",
          "beacon": "0xa38175d60e5f3b08989694af084abdb9d86efba7"
        },
        "bridgeToken": {
          "implementation": "0x4fc8561f45da09098b0fe0f983a16202bf03106a",
          "proxy": "0x0000000000000000000000000000000000000000",
          "beacon": "0xc19123a2afcc71220f603aec6228bc527db39fd0"
        },
        "ethHelper": "0x64586c361748e1973efdccda47c43bfd255d5238",
        "customs": []
      },
      "kovan": {
        "deployHeight": 31134545,
        "bridgeRouter": {
          "implementation": "0x2b56f51f74917852d19ec0b127358122a461dee3",
          "proxy": "0xff3ecfa871d0419abf55ba5395c10c3c321c108c",
          "beacon": "0xa3ff2c100c10fa34f3f79c79dd39aa86bc54326e"
        },
        "tokenRegistry": {
          "implementation": "0x1d734e5897e8c98a25436bb85780e001310d5f34",
          "proxy": "0xbedbb76cea6a3dc28ec3afbc137ec3b4749f4467",
          "beacon": "0x4b6771cbd12526cba501b9e14cf98c391c4c8fdf"
        },
        "bridgeToken": {
          "implementation": "0x9b5f25ae3edaf2ec85c484f425dce0dbe9ba7c98",
          "proxy": "0x0000000000000000000000000000000000000000",
          "beacon": "0x7af50c002a7e9e6fc683d8ca1d6840d3b5c285b7"
        },
        "ethHelper": "0xd71410e8f988ba97e95e2833ebf8d6c42cbcaa2d",
        "customs": []
      },
      "goerli": {
        "deployHeight": 6748625,
        "bridgeRouter": {
          "implementation": "0x9b68006a0740411a315ceeda30f160a5263af005",
          "proxy": "0x17e9b5d4fbd4359875e19bd06359ded7fba33f4c",
          "beacon": "0x1e0db0d3361c6e7e78b68079cad63daf5e337c49"
        },
        "tokenRegistry": {
          "implementation": "0xe195d2e4c247b5cce1630cb0b39d8bfedf66c0f3",
          "proxy": "0xcaca3358fd90c8e7ae9689ac4d21a8a7ec58c030",
          "beacon": "0x20d53a6835d201fcf9cceab9309a044f75388b83"
        },
        "bridgeToken": {
          "implementation": "0xa42a96cfd0ecdb41514908d8e0a0a55b14ec199d",
          "proxy": "0x0000000000000000000000000000000000000000",
          "beacon": "0xa0f7bd4594dacc63a91b3c7857dbc789309aabe8"
        },
        "ethHelper": "0x6f646837e542b47a7c982da5ceb3676caabc00bf",
        "customs": []
      },
      "evmostestnet": {
        "deployHeight": 943064,
        "bridgeRouter": {
          "implementation": "0x52dbd0c2b9387ded247022806b645dc8a5aee8ff",
          "proxy": "0x2d12e31c4ec3ee566b6f6eaab89875f4c18ef971",
          "beacon": "0x3a58831408c67bf1ec7b4de773552c87a169b37e"
        },
        "tokenRegistry": {
          "implementation": "0xbf394c127403ea4aaf56f42b8217fb4544c6e5be",
          "proxy": "0x8887b5b8c798720690f8ca5a15bf26c3984f20e8",
          "beacon": "0x3014dd7f749a62baea07b96fb929f14001a2e87f"
        },
        "bridgeToken": {
          "implementation": "0xb0b95e5cc3e922a2b67fd3bbca1c18603a4d0ba4",
          "proxy": "0x0000000000000000000000000000000000000000",
          "beacon": "0x96f2380d5240e3634692694eab82f5609caee18d"
        },
        "ethHelper": "0x3bfcdad68bea1ed61fac49d050dabe0e1a482d30",
        "customs": []
      }
    },
    "agent": {},
    "gas": {},
    "bridgeGui": {}
  };