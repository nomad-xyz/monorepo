import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { ethers } from "ethers";
import { green, red, yellow } from "./color";
import { pconfig } from "./configs";
import {  Network, WalletAccount } from "./account";
import { AwsKmsSigner } from "./kms";
import { BunyanLevel } from './utils';
import { Keymaster } from "./keymaster";
import { MyJRPCProvider } from "./retry_provider/provider";
import { Context } from "./context";


const logLevel = (process.env.LOG_LEVEL || 'debug') as BunyanLevel;

async function std() {
  const km = (new Keymaster(pconfig)).init();

    await km.reportLazyAllNetworks();
    km.ctx.metrics.startServer(9092);
}

/*
docker run -d -e "BLOCK_TIME=1000" \
-e "PRIVATE_KEY1=1000000000000000000000000000000000000000000000000000000000000001" \
-e "PRIVATE_KEY2=2000000000000000000000000000000000000000000000000000000000000002" \
-p 8545:8545 --name tom hardhat
*/

async function local() {
  // const environment = getEnvironment();
  // console.log(environment)
  // const logger = createLogger('indexer', {environment, logLevel});
  // const m = new KeyMasterMetricsCollector(environment, logger);

  const ctx = new Context();

  const p = new MyJRPCProvider('http://localhost:8545', 'local', ctx);
  const w = new WalletAccount('0xCAaCF83457dE300B0278E80641667dF147e9f440', p, ctx)
  // const bank = new AwsKmsSigner(, p);
  const bank: ethers.Signer = new ethers.Wallet(
    '1000000000000000000000000000000000000000000000000000000000000001'
  ).connect(p);
  const n = new Network('local', p, [
    w
  ], bank, ctx);

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
  const ctx = new Context();

  const p = new StaticJsonRpcProvider('http://localhost:8545');
  const w = new WalletAccount('0xCAaCF83457dE300B0278E80641667dF147e9f440', p, ctx);
  // const bank = new AwsKmsSigner(, p);
  const bank: ethers.Signer = new ethers.Wallet(
    '1000000000000000000000000000000000000000000000000000000000000001'
  ).connect(p);
  const n = new Network('local', p, [], bank, ctx);
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




