import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { ethers } from "ethers";
import { green, red, yellow } from "./color";
import { pconfig } from "./configs";
import { Keymaster, Network, WalletAccount } from "./context";
import { AwsKmsSigner } from "./kms";
import { eth, getEnvironment, NomadEnvironment } from "./utils";
import { BunyanLevel, createLogger } from './utils';


const logLevel = (process.env.LOG_LEVEL || 'debug') as BunyanLevel;

// const logger = createLogger('indexer', environment, logLevel);
async function std() {
  const ctx = (new Keymaster(pconfig)).init();

    // await ctx.checkAllNetworks();
    await ctx.reportLazyAllNetworks();
}

/*
docker run -d -e "BLOCK_TIME=1000" \
-e "PRIVATE_KEY1=1000000000000000000000000000000000000000000000000000000000000001" \
-e "PRIVATE_KEY2=2000000000000000000000000000000000000000000000000000000000000002" \
-p 8545:8545 --name tom hardhat
*/

async function local() {
  const environment = getEnvironment();
  console.log(environment)
  const logger = createLogger('indexer', {environment, logLevel});

  const p = new StaticJsonRpcProvider('http://localhost:8545');
  const w = new WalletAccount('0xCAaCF83457dE300B0278E80641667dF147e9f440', p, {logger: logger.child({account: '0xCAaCF83'})})
  // const bank = new AwsKmsSigner(, p);
  const bank: ethers.Signer = new ethers.Wallet(
    '1000000000000000000000000000000000000000000000000000000000000001'
  ).connect(p);
  const n = new Network('local', p, [
    w
  ], bank, {treshold: eth(1)}).with(logger.child({network: 'local'}));

  const r = await n.reportSuggestion();

  let _toPay = ethers.BigNumber.from(0);

  const ke = ethers.utils.formatEther;
  const payments: Promise<ethers.providers.TransactionReceipt>[] = [];
  const lol = r.map(([a, balance, toPay]) => {
    if (a._address) payments.push(n.bank.pay(a._address!, toPay));
    _toPay = _toPay.add(toPay);
    const shouldTopUp = toPay.gt(0);
    if (shouldTopUp) {
      if (balance.eq(0)) {
        return red(`${a.name} needs immediately ${ke(toPay)} currency. It is empty for gods sake!`)
      } else {
        return yellow(`${a.name} needs to be paid ${ke(toPay)}. Balance: ${ke(balance)}`)
      }
    } else {
      return green(`${a.name} is ok, has: ${ke(balance)}`)
    }
  });
  console.log(lol.join('\n'))
  console.log(red(ke(_toPay.toString())));

  await Promise.all(payments);

  console.log(`${green(ke(await bank.getBalance()))}\n`)
  console.log(`${yellow(ke(await w.balance()))}\n`)
}

async function remote() {
  const environment = getEnvironment();
  console.log(environment)
  const logger = createLogger('indexer', {environment, logLevel});

  const p = new StaticJsonRpcProvider('http://localhost:8545');
  const w = new WalletAccount('0xCAaCF83457dE300B0278E80641667dF147e9f440', p, {logger: logger.child({account: '0xCAaCF83'})});
  // const bank = new AwsKmsSigner(, p);
  const bank: ethers.Signer = new ethers.Wallet(
    '1000000000000000000000000000000000000000000000000000000000000001'
  ).connect(p);
  const n = new Network('local', p, [], bank, {treshold: eth(1), logger});
  n.addBalances(w);

  const r = await n.reportSuggestion();

  let _toPay = ethers.BigNumber.from(0);

  const ke = ethers.utils.formatEther;
  const payments: Promise<ethers.providers.TransactionReceipt>[] = [];
  const lol = r.map(([a, balance, toPay]) => {
    if (a._address) payments.push(n.bank.pay(a._address!, toPay));
    _toPay = _toPay.add(toPay);
    const shouldTopUp = toPay.gt(0);
    if (shouldTopUp) {
      if (balance.eq(0)) {
        return red(`${a.name} needs immediately ${ke(toPay)} currency. It is empty for gods sake!`)
      } else {
        return yellow(`${a.name} needs to be paid ${ke(toPay)}. Balance: ${ke(balance)}`)
      }
    } else {
      return green(`${a.name} is ok, has: ${ke(balance)}`)
    }
  });
  console.log(lol.join('\n'))
  console.log(red(ke(_toPay.toString())));

  await Promise.all(payments);

  console.log(`${green(ke(await bank.getBalance()))}\n`)
  console.log(`${yellow(ke(await w.balance()))}\n`)
}

(async () => {
  await std();
    // await remote();
})();




