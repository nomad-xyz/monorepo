import { AvailHardhat, HardhatNetwork } from "../src/network";
import { NomadEnv } from "../src/nomadenv";
import { Key } from "../src/keys/key";
import type { TokenIdentifier } from "@nomad-xyz/sdk-bridge";
// import fs from "fs";
import { getCustomToken } from "./utils/token/deployERC20";
import { getRandomTokenAmount, readLine, sleep } from "../src/utils";
import { sendTokensAndConfirm } from "./common";
import bunyan from 'bunyan';
import { NomadDomain } from "../src/domain";
import { expect, assert } from "chai";
import fs from 'fs';

describe("AVAIL test", () => {
  // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
  const log = bunyan.createLogger({name: 'localenv'});

  // Instantiate HardhatNetworks
  const t = new HardhatNetwork('tom', 1);
  const j = new AvailHardhat('jerry', 2);

  const sender = new Key();
  const receiver = new Key();

  // Instantiate Nomad domains
  const tDomain = new NomadDomain(t);
  const jDomain = new NomadDomain(j);

  const le = new NomadEnv({domain: t.domainNumber, id: '0x'+'20'.repeat(20)});

  t.addKeys(sender);
  j.addKeys(receiver);

  le.addDomain(tDomain);
  le.addDomain(jDomain);
  log.info(`Added Tom and Jerry`);
  
  tDomain.connectNetwork(jDomain);
  jDomain.connectNetwork(tDomain);
  log.info(`Connected Tom and Jerry`);
    it("should do the deployment", async function () {
      

      await le.upNetworks();
      log.info(`Upped Tom and Jerry`);

      await j.handler.subscribeToContainerEvents();
      j.handler.attachLogMatcher();
      j.handler.logMatcher!.register(/(eth_\w+)/g, (found) => {
        fs.appendFileSync('/tmp/jerry_events.txt', `found -> ${found[0]} ${new Date().valueOf()}\n`)
      });

      await t.handler.subscribeToContainerEvents();
      t.handler.attachLogMatcher();
      t.handler.logMatcher!.register(/(eth_\w+)/g, (found) => {
        fs.appendFileSync('/tmp/tom_events.txt', `found -> ${found[0]} ${new Date().valueOf()}\n`)
      });
      // j.handler.logMatcherRegisterEvent(
      //   "requests_happening",
      //   /(eth_\w+)/
      // );
      // j.handler.logMatcher!.on('requests_happening', async (eventMatch) => {

      // })

      // Notes, check governance router deployment on Jerry and see if that's actually even passing
      // ETHHelper deployment may be failing because of lack of governance router, either that or lack of wETH address.

      // await Promise.all([
      t.setWETH(await t.deployWETH()),
      j.setWETH((new Key()).toAddress())

      
      // ])

      log.info(await le.deployCores());

    })

    
    afterAll(async() => {
      await le.down();
    })
})