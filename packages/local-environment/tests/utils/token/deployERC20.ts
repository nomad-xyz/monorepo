import fs from "fs";
import { ethers } from "ethers";
const solc = require("solc");

export function getCustomToken() {
  const solFilename = "Token.sol";
  const solLocation = __dirname + "/contract";

  const sources = Object.fromEntries(
    fs.readdirSync(solLocation).map((filename) => {
      const solPath = `${solLocation}/${filename}`;
      return [
        filename,
        {
          content: fs.readFileSync(solPath, "utf8"),
        },
      ];
    })
  );

  const input = {
    language: "Solidity",
    sources,
    settings: {
      outputSelection: {
        "*": {
          "*": ["*"],
        },
      },
    },
  };
  const tempFile = JSON.parse(solc.compile(JSON.stringify(input)));
  const {
    abi,
    evm: {
      bytecode: { object: bytecode },
    },
  } = tempFile.contracts[solFilename]["Token"];

  return new ethers.ContractFactory(abi, bytecode);

  // const contract = await factory.deploy("MyToken", "MTK");

  // console.log(`MTK address -> ${contract.address}`);

  // await contract.deployed();
  // return contract.address
}
