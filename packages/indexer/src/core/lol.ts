import fs from "fs";

const target = new Map([
  ["destination", "25393"],
  [
    "recipient",
    "0x000000000000000000000000ea4c988b5c56a1898c50797478097b1cb83cbce7",
  ],
  ["origin", "1650811245"],
  [
    "root",
    "0x9220ef5efe52115f663e312045aea79460abf3aee785fa43147b0b06ba1446ca",
  ],
  ["nonce", "4"],
  [
    "hash",
    "0x4d69326028c3c11a5d1a25745f87b5ab79e416eedf5bc04040192c2def314736",
  ],
]);

(async () => {
  const lines = fs.readFileSync("./lol.txt", "utf8").split("\n");

  for (const line of lines) {
    const metaN = line.match(/\{[\w\d\:\,]+\}/);

    if (!metaN) continue;
    const meta = new Map(
      metaN[0]
        .slice(1, -1)
        .split(",")
        .map((m) => m.split(":")) as [string, string][]
    );
    if (
      Array.from(meta).every(([key, value]) => {
        const x = target.get(key) == value;
        return x;
      })
    ) {
      console.log(line);
    }
  }
})();

/*
I dont know what this is, but it doesnt shaw any other events except of creation
const target = new Map([
    ['destination', '6648936'],
    ['recipient',  '0x0000000000000000000000008da8a71b40429f558569daf38df600885c04ebbb'],
    ['origin',  '1650811245'],
    ['root',  '0x9dfa09cd7f90b6ef2832474b2a6b2444af5768b6de8e1d5b88836ee0f02a49d3'],
    ['nonce',  '1262'],
    ['hash',  '0x941e247d84e262073f61ecf4f7c41c6fdc7669aa76382a88bd9ffcabf72946ac'],
]);
*/
