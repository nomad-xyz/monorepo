import { KeymasterConfig } from "./config";
import { eth } from "./utils";

export const sconfig: KeymasterConfig = {
    networks: {
        "goerli": {
            name: "goerli",
          replicas: ['rinkeby', 'evmostestnet', 'kovan'],
          endpoint: 'https://goerli.infura.io/v3/xxxxxxxxxxxxxxxxx',
          bank: 'yyyyyyyyyyyyyyyyy',
          treshold: eth(1),
          agents: {
            "kathy": "0xF8C4BdeB88fD5913eb06f95A796aaB70DA2b3F8b",
            "watchers": ["0xE21Df231781A6D1fC5B5cAd70c161A3A9E4cc46e"],
            "updater": "0x4220f62C0d5DC79eE89D820e2aa3c6D087c78162",
            "relayer": "0x59D22083CB47278eB8e7da1C7B6EFc5F20271012",
            "processor": "0x48fc495922Be79fB7D27eE267a1DFC4858b585c9"
        }
        },
        "rinkeby": {
            name: "rinkeby",
          replicas: ['goerli', 'evmostestnet', 'kovan'],
          endpoint: 'https://rinkeby.infura.io/v3/xxxxxxxxxxxxxxxxx',
          bank: 'yyyyyyyyyyyyyyyyy',
          treshold: eth(1),
          agents: {
            "kathy": "0x2BE6635a758562086591DDF89dc9af4557a1fbe5",
            "watchers": ["0xA39A0Fe69eE4D59aD62361A3D02e1272FE65eCe6"],
            "updater": "0x7b5E8921fb41f6c720366Caaf5F1E5CEdFD2E86E",
            "relayer": "0x454fa6cD630c8Fb29582BEcd0EB7cA41ff258225",
            "processor": "0x9f2CA7C304ed2435049802808e2F9278eCd7b56b"
        }
        },
        "evmostestnet": {
            name: "evmostestnet",
          replicas: ['goerli', 'rinkeby', 'kovan'],
          endpoint: 'https://eth.bd.evmos.dev:8545',
          bank: 'yyyyyyyyyyyyyyyyy',
          treshold: eth(1),
          agents: {
            "kathy": "0x9efB6774756495D350416F394aCB44f98e306c8e",
            "watchers": ["0x7A144C22D59AfEE75a093933b02e83dc14F920e9"],
            "updater": "0x958FC2f4409033a83F4176eF6208c8BDf1A016B3",
            "relayer": "0x613F7960F131Aa9FbD81f902aB9fCaBEB10577C8",
            "processor": "0x2A20D3D4880E49530001cd7A9E21Cb1cEE64FE17"
        }
        },
        "kovan": {
            name: "kovan",
          replicas: ['goerli', 'rinkeby', 'evmostestnet'],
          endpoint: 'https://kovan.infura.io/v3/xxxxxxxxxxxxxxxxx',
          bank: 'yyyyyyyyyyyyyyyyy',
          treshold: eth(1),
          agents: {
            "kathy": "0xBB3B3fecA4dE35e36d71eF2e8B51Af96740Aea6c",
            "watchers": ["0xE5b60deA69eaF5a54903367Dd283B45869CFF55B"],
            "updater": "0x3E7a655a47eF01E688fA0feCDB9bfdDae51F7876",
            "relayer": "0xB4C605360C81D94080325176fea4B5C3bcdd3EF3",
            "processor": "0x815d6b30Ed21e78cc3FebBFCcE9D346FdD0cf60F"
        }
        } 
    }
  };
  
  export const dconfig: KeymasterConfig = {
      networks: {
          "goerli": {
              name: "goerli",
            replicas: ['rinkeby', 'evmostestnet', 'kovan'],
            endpoint: 'https://goerli.infura.io/v3/xxxxxxxxxxxxxxxxx',
            bank: 'yyyyyyyyyyyyyyyyy',
            treshold: eth(1),
            agents: {
              "kathy": "0xF5e6CC7FA0bf3c96B3def2863eC0dC03ce5DC737",
              "watchers": ["0xe478d86Cda583ff7c1C9A50Fc476BdA61b7f34Ae"],
              "updater": "0xef7F857D2a76e619cdbE812e03d0e2236dC0a1cF",
              "relayer": "0x88dF323EbfA1fD671FBf14e4A897e076ed6C12CD",
              "processor": "0x88130d3121EAF7f3285FDd7bbd3a1eF53F2D6e16"
          }
          },
          "rinkeby": {
              name: "rinkeby",
            replicas: ['goerli', 'evmostestnet', 'kovan'],
            endpoint: 'https://rinkeby.infura.io/v3/xxxxxxxxxxxxxxxxx',
            bank: 'yyyyyyyyyyyyyyyyy',
            treshold: eth(1),
            agents: {
              "kathy": "0xCB01D41eb608e9C6Af7d7021AabC659E29093247",
              "watchers": ["0x904ECE03De028de624BD221cC86aad73afD8a5BE"],
              "updater": "0xe86a73D409f6a8A10Ab1995A8633E1A1CbB9D27c",
              "relayer": "0xD1855a9D4b4BdED86a857398d8ee7077269844A2",
              "processor": "0xE65d339d794546e77902b9E7b36aA224dCE8b294"
          }
          },
          "evmostestnet": {
              name: "evmostestnet",
            replicas: ['goerli', 'rinkeby', 'kovan'],
            endpoint: 'https://eth.bd.evmos.dev:8545',
            bank: 'yyyyyyyyyyyyyyyyy',
            treshold: eth(1),
            agents: {
              "kathy": "0xdE02dF46DDb0bBf32b61C0201D59f4a1C8370E1A",
              "watchers": ["0xf3278a64bF9D5D518f9A1B4810f92633d67fDDA4"],
              "updater": "0xB758E1C5A22F99cC29d4e07e3616fBD6C9fAfCce",
              "relayer": "0xDDB92c91c3dC97021468E779666c15df73F94377",
              "processor": "0x9a5DBF36aac85bE412b741313E122a748125a9B8"
          }
          },
          "kovan": {
              name: "kovan",
            replicas: ['goerli', 'rinkeby', 'evmostestnet'],
            endpoint: 'https://kovan.infura.io/v3/xxxxxxxxxxxxxxxxx',
            bank: 'yyyyyyyyyyyyyyyyy',
            treshold: eth(1),
            agents: {
              "kathy": "0x0111bFfB0182cC81dE36535adcC904ED9dc59F11",
              "watchers": ["0x47C67e481530fb37E0F1FaeDdf4ce0d614a20ED3"],
              "updater": "0x525b92c9634dEF302596cF1128B73bD54977f749",
              "relayer": "0x5F0d70a8c3057d00eDED1FAbcC0843b44CFb84A6",
              "processor": "0xec6646520BBF594BD5C08DDac74f430e145faDa7"
          }
          } 
      }
  };
  
  export const pconfig: KeymasterConfig = {
    networks: {
        "ethereum": {
            name: "ethereum",
          replicas: ["moonbeam", "milkomedac1", "xdai", "evmos", "avalanche"],
          endpoint: 'https://goerli.infura.io/v3/xxxxxxxxxxxxxxxxx',
          bank: 'yyyyyyyyyyyyyyyyy',
          treshold: eth(1),
          agents: {
            "watchers": ["0x9Ed61aa3EfDf5afed02076299d4366d26ee373b7"],
            "updater": "0x28A30e6736789dBF6FE9d4e86Df75a866F3d28b8",
            "relayer": "0x9C6c806736c18d646c28ff47Bee0aF15284792a7",
            "processor": "0x776a9097E01De7E7aA2ddd92989f27c8B5C3AE68"
        }
        },
        "moonbeam": {
            name: "moonbeam",
          "replicas": ["ethereum", "milkomedac1", "xdai", "evmos", "avalanche"],
          "endpoint": 'https://goerli.infura.io/v3/xxxxxxxxxxxxxxxxx',
          "bank": 'yyyyyyyyyyyyyyyyy',
          "treshold": eth(1),
          "agents": {
              "watchers": ["0x1C22c47512EF3df39944d4A28267cf830d2f6206"],
              "updater": "0x93cc02A518e591Bf22D1C245a5e1A2b85736bC93",
              "relayer": "0x10121Cb2b3F64f0A6231178336ACa3e3b87D5cA5",
              "processor": "0xaf26D799dD372ea983c40855A4085f6B765616B0"
          }
      },
      "milkomedac1": {
          name: "milkomedac1",
          "replicas": ["ethereum", "moonbeam", "xdai", "evmos", "avalanche"],
          "endpoint": 'https://goerli.infura.io/v3/xxxxxxxxxxxxxxxxx',
          "bank": 'yyyyyyyyyyyyyyyyy',
          "treshold": eth(1),
          "agents": {
              "watchers": ["0x925d692aa1F4109F910C502368c569e68CEb7F61"],
              "updater": "0xCC4D47670498cb3fB2232435Ae6F9b2cbb6bc678",
              "relayer": "0x0173544f21B4Fb7C5e2BC93968b1dDE13F0dfCD2",
              "processor": "0xc557bD20E66602f2c024ac1E2DCAA82ae5c69A70"
          }
      },
      "xdai": {
          name: "xdai",
          "replicas": ["ethereum", "moonbeam", "milkomedac1", "evmos", "avalanche"],
          "endpoint": 'https://goerli.infura.io/v3/xxxxxxxxxxxxxxxxx',
          "bank": 'yyyyyyyyyyyyyyyyy',
          "treshold": eth(1),
          "agents": {
              "watchers": ["0x1705725CbD1f03e78B47ad203C65db5768e49133"],
              "updater": "0x67DF640558f4BA7D8DEee3852493b7cBd6ef08B0",
              "relayer": "0xEACC6055b8B61DD574A8Bf5683acb8F8b141F9Dd",
              "processor": "0xF8FAe646794D8Da31bab9d059f83d7502FD4875C"
          }
      },
      "evmos": {
          name: "evmos",
          "replicas": ["ethereum", "moonbeam", "milkomedac1", "xdai", "avalanche"],
          "endpoint": 'https://goerli.infura.io/v3/xxxxxxxxxxxxxxxxx',
          "bank": 'yyyyyyyyyyyyyyyyy',
          "treshold": eth(1),
          "agents": {
              "watchers": ["0x07495A8406039c311281724a03264649f7a817E4"],
              "updater": "0x1832cf33e44293B1cE2480aa36af3c545dB2db3C",
              "relayer": "0x45E426D9B501f380dB0b1C323B57b0B7CF380cF9",
              "processor": "0x706198AF9d8AFE8CEd7187eEf5573a516F60BC68"
          }
      },
      "avalanche": {
          name: "avalanche",
          "replicas": ["ethereum", "moonbeam", "milkomedac1", "xdai", "evmos"],
          "endpoint": 'https://goerli.infura.io/v3/xxxxxxxxxxxxxxxxx',
          "bank": 'yyyyyyyyyyyyyyyyy',
          "treshold": eth(1),
          "agents": {
              "watchers": ["0x3392D661954A1af73be1daA049f002e1725dDc52"],
              "updater": "0xf5Be008E5B665157Ab0D433fa62A190974e5A928",
              "relayer": "0xfF3703E510f4Ff4D8686f2f33f722D5C565D18f7",
              "processor": "0xD93EEb8d4333FdAf4D58acFd02A9db7fc3EB5435"
          }
      }
    }
  };