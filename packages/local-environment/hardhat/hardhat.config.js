require("@nomiclabs/hardhat-waffle");
// require("@foundry-rs/hardhat-anvil");
require("dotenv").config();

console.log("You are currently on " + defaultNetwork);

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const accounts = [
    "a00000000000000000000000000000000000000000000000000000000000000a", // Service account
    process.env.PRIVATE_KEY ||
    "1337000000000000000000000000000000000000000000000000000000001337",


    process.env.PRIVATE_KEY1 || '1000000000000000000000000000000000000000000000000000000000000001',
    process.env.PRIVATE_KEY2 || '2000000000000000000000000000000000000000000000000000000000000002',
    process.env.PRIVATE_KEY3 || '3000000000000000000000000000000000000000000000000000000000000003',
    process.env.PRIVATE_KEY4 || '4000000000000000000000000000000000000000000000000000000000000004',
    process.env.PRIVATE_KEY5 || '5000000000000000000000000000000000000000000000000000000000000005',

  ...Object.entries(process.env)
    .filter(([k, _]) => k.match(/PRIVATE_KEY\d+/))
    .map(([_, v]) => v),

    process.env.PRIVATE_KEY6 || '6000000000000000000000000000000000000000000000000000000000000006',
    process.env.PRIVATE_KEY7 || '7000000000000000000000000000000000000000000000000000000000000007',
    process.env.PRIVATE_KEY8 || '8000000000000000000000000000000000000000000000000000000000000008',
    process.env.PRIVATE_KEY9 || '9000000000000000000000000000000000000000000000000000000000000009',
].map((privateKey) => ({
  privateKey,
  balance: String(10 ** 20), // 100 ETH. It is quite tricky: as String(10**20) is '1000...000', but String(10**21) is '1e+21'
}));

let blockTime = 1000;
if (process.env.BLOCK_TIME) {
  try {
    blockTime = parseInt(process.env.BLOCK_TIME) || 1000;
  } catch (_) {}
}

console.log(`Staring with accounts:`, accounts.map(a=>a.privateKey));

let defaultNetwork = "hardhat";

if (process.env.ALCHEMY_API_KEY) {
  defaultNetwork = "forking";
}

module.exports = {
  solidity: "0.8.4",
  defaultNetwork: defaultNetwork,
  networks: {
    hardhat: {
      mining: {
        auto: false,
        interval: blockTime,
      },
      // url: "http://0.0.0.0:8545",
      accounts,
    },
    forking: {
      url: "https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}",
      blockNumber: parseInt(process.env.BLOCK_NUMBER),
    },
  },
};
