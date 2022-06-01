import { KeymasterConfig } from "./config";
import { Keymaster } from "./context";
import { devConfig } from "./devConfig";



const kconfig: KeymasterConfig = {
    networks: {
        "goerli": {
          endpoint: 'https://goerli.infura.io/v3/xxx',
          bank: 'xxx',
          treshold: '2000000000000000000',
          agents: {
            relayer: '0x88dF323EbfA1fD671FBf14e4A897e076ed6C12CD',
            processor: '0x88130d3121EAF7f3285FDd7bbd3a1eF53F2D6e16'
          }
        },
        "rinkeby": {
          endpoint: 'https://rinkeby.infura.io/v3/xxx',
          bank: 'xxx',
          treshold: '2000000000000000000',
          agents: {
            relayer: '0xD1855a9D4b4BdED86a857398d8ee7077269844A2',
            processor: '0xE65d339d794546e77902b9E7b36aA224dCE8b294'
          }
        },
        "evmostestnet": {
          endpoint: 'https://eth.bd.evmos.dev:8545',
          bank: 'xxx',
          treshold: '2000000000000000000',
          agents: {
            relayer: '0xDDB92c91c3dC97021468E779666c15df73F94377',
            processor: '0x9a5DBF36aac85bE412b741313E122a748125a9B8'
          }
        },
        "kovan": {
          endpoint: 'https://kovan.infura.io/v3/xxx',
          bank: 'xxx',
          treshold: '2000000000000000000',
          agents: {
            relayer: '0x5F0d70a8c3057d00eDED1FAbcC0843b44CFb84A6',
            processor: '0xec6646520BBF594BD5C08DDac74f430e145faDa7'
          }
        } 
    }
};

// const nconfig = 



(async () => {
    // const ctx = await Keymaster.fromEnvName('development', kconfig);
    const ctx = (new Keymaster(devConfig, kconfig)).init();

    const address = await ctx.getBank('kovan').getAddress();

    const balance = await ctx.bankBalance('kovan');
    console.log(`--->`, address, balance.toString());
    
    const bs = Object.fromEntries(await Promise.all(ctx.networks.map(async (n) => [n, (await ctx.bankBalance(n)).div('1'+'0'.repeat(18)).toString()])));
    console.log(bs)


    // ctx.config.agent
})();




