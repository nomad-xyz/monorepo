import "hardhat-gas-reporter";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-etherscan";

import * as dotenv from "dotenv";
dotenv.config();

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
  },
};
