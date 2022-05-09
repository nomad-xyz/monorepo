const {MerkleTree} = require('merkletreejs')
const SHA256 = require('crypto-js/sha256')
const {ethers} = require('ethers')

const args = process.argv.slice(2);

if (args.length != 1) {
  console.log(`please supply the correct parameters:
    metadata
  `)
  process.exit(1);
}
let messages = ;
const leaves = messages.map(x => SHA256(x))
const tree = new MerkleTree(leaves, SHA256)
const root = tree.getRoot().toString('hex')
const leaf = SHA256('53')
const proof = tree.getHexProof(leaf)


const iface = new ethers.utils.Interface(abi)
encoded = iface.encodeFunctionData("foo", meta)
process.stdout.write("0x" + encoded.slice(10))
