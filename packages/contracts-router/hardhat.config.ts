import "hardhat-gas-reporter";
import "@typechain/hardhat";
import "hardhat-packager";

import * as dotenv from "dotenv";
dotenv.config();

const infuraKey = process.env.INFURA_API_KEY;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
      },
    },
  },

  gasReporter: {
    currency: "USD",
  },

  networks: {
    localhost: {
      url: "http://localhost:8545",
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${infuraKey}`,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infuraKey}`,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${infuraKey}`,
    },
  },

  typechain: {
    outDir: "./src",
    target: "ethers-v5",
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
  },

  // config for hardhat-packager
  // https://www.npmjs.com/package/hardhat-packager
  packager: {
    contracts: ["Router"],
    includeFactories: true,
  },
};
