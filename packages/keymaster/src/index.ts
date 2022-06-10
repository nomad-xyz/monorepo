import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { ethers } from "ethers";
import { green, red, yellow } from "./color";
import { dconfig, dconfigkms, pconfig, sconfig } from "./configs";
import {  Network, WalletAccount } from "./account";
import { AwsKmsSigner } from "./kms";
import { BunyanLevel, readConfig, sleep } from './utils';
import { Keymaster } from "./keymaster";
import { MyJRPCProvider } from "./retry_provider/provider";
import { Context } from "./context";


const logLevel = (process.env.LOG_LEVEL || 'debug') as BunyanLevel;

async function std() {
  const km = (new Keymaster(dconfig)).init();

    await km.payLazyAllNetworks(false);
    // await km.reportLazyAllNetworks();
    km.ctx.metrics.startServer(9092);
}

async function stdkms() {
  const km = (new Keymaster(dconfigkms)).init();

    // await km.reportLazyAllNetworks();
    await km.payLazyAllNetworks();
    km.ctx.metrics.startServer(9092);
}

async function stagestd() {
  const config = readConfig('./configs/develop.json');
  const km = (new Keymaster(config)).init();

    await km.payLazyAllNetworks(true);
    // await km.reportLazyAllNetworks();
    km.ctx.metrics.startServer(9092);
}

async function run(configPath: string, port: number, dryrun=false) {
  const config = readConfig(configPath);
  const km = (new Keymaster(config)).init();
  km.ctx.metrics.startServer(port);

  while (true) {
    await km.payLazyAllNetworks(dryrun);

    await sleep(60 * 1000);
  }
}

async function singlekms() {
  const ctx = new Context();

  const p = new MyJRPCProvider('https://kovan.infura.io/v3/x', 'kovan', ctx);
  const w = new WalletAccount('0x872f4F3c90e2241B7402044955653B836C68eEd0', p, ctx)
  const bank = new AwsKmsSigner({
    accessKeyId: '',
    secretAccessKey: '',
    region: '',
    keyId: ''
  }, p);

  const b = await bank.getBalance();
  const a = await bank.getAddress();
  console.log(b, a)
  // const bank: ethers.Signer = new ethers.Wallet(
  //   '1000000000000000000000000000000000000000000000000000000000000001'
  // ).connect(p);
  const n = new Network('kovan', p, [
    w
  ], bank, ctx);

  // const r = await n();
  // const km = new Keymaster()
  await n.checkAndPay();

  // let _toPay = ethers.BigNumber.from(0);

  // const ke = ethers.utils.formatEther;
  // const payments: Promise<ethers.providers.TransactionReceipt>[] = [];
  // const lol = r.map(([a, balance, toPay]) => {
  //   if (a._address) payments.push(n.bank.pay(a._address!, toPay));
  //   _toPay = _toPay.add(toPay);
  //   const shouldTopUp = toPay.gt(0);
  //   if (shouldTopUp) {
  //     if (balance.eq(0)) {
  //       return red(`${a.name} needs immediately ${ke(toPay)} currency. It is empty for gods sake!`)
  //     } else {
  //       return yellow(`${a.name} needs to be paid ${ke(toPay)}. Balance: ${ke(balance)}`)
  //     }
  //   } else {
  //     return green(`${a.name} is ok, has: ${ke(balance)}`)
  //   }
  // });
  // console.log(lol.join('\n'))
  // console.log(red(ke(_toPay.toString())));

  // await Promise.all(payments);

  // console.log(`${green(ke(await bank.getBalance()))}\n`)
  // console.log(`${yellow(ke(await w.balance()))}\n`)
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
  const lol = r.map(([a, balance, shouldTopUp, toPay]) => {
    if (a._address) payments.push(n.bank.pay(a._address!, toPay));
    _toPay = _toPay.add(toPay);
    // const shouldTopUp = toPay.gt(0);
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
  const lol = r.map(([a, balance, shouldTopUp, toPay]) => {
    if (a._address) payments.push(n.bank.pay(a._address!, toPay));
    _toPay = _toPay.add(toPay);
    // const shouldTopUp = toPay.gt(0);
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
  await run('./configs/develop.json', 9090, true);
  // await stdkms();
  // await singlekms();
})();




