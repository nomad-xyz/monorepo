import { NomadEnv } from "../src/nomadenv";
import { Key } from "../src/keys/key";
import type { TokenIdentifier } from "@nomad-xyz/sdk-bridge";
import fs from "fs";
import { getCustomToken } from "./utils/token/deployERC20";
import { getRandomTokenAmount } from "../src/utils";
import { sendTokensAndConfirm } from "./common";
import * as dotenv from "dotenv";
import bunyan from 'bunyan';
import { expect, assert } from "chai";
import { NomadDomain } from "../src/domain";

if (!fs.existsSync("../../.env"))
  dotenv.config({ path: __dirname + "/../.env.example" });
else dotenv.config();

describe("Token test", () => {
    // Ups 2 new hardhat test networks tom and jerry to represent home chain and target chain.
    const log = bunyan.createLogger({name: 'localenv'});

    const sender = new Key();
    const receiver = new Key();

    const le = new NomadEnv({domain: 1, id: '0x'+'20'.repeat(20)});

    if (process.env.ALCHEMY_FORK_URL) {
      log.info(`Using Alchemy API ` + process.env.ALCHEMY_FORK_URL + ` to start a forked network`);
    };
    
    let tDomainNumber = 1;
    let jDomainNumber = 2;
  
    if (process.env.tDomainNumber) {
      tDomainNumber = parseInt(process.env.tDomainNumber);
    }
  
    if (process.env.jDomainNumber) {
      jDomainNumber = parseInt(process.env.jDomainNumber);
    }

    const tom = NomadDomain.newHardhatNetwork("tom", tDomainNumber, { forkurl: `${process.env.ALCHEMY_FORK_URL}`, weth: `${process.env.WETH_ADDRESS}`, nomadEnv: le });
    const jerry = NomadDomain.newHardhatNetwork("jerry", jDomainNumber, { forkurl: `${process.env.ALCHEMY_FORK_URL}`, weth: `${process.env.WETH_ADDRESS}`, nomadEnv: le });
    const tDomain = le.addNetwork(tom.network);
    const jDomain = le.addNetwork(jerry.network);
    log.info(`Added Tom and Jerry`);

    tDomain.network.addKeys(sender);
    jDomain.network.addKeys(receiver);
    
    tDomain.connectDomain(jDomain);
    log.info(`Connected Tom and Jerry`);

    async function setUp() {
        await le.upNetworks();
        log.info(`Upped Tom and Jerry`);
    
        // Notes, check governance router deployment on Jerry and see if that's actually even passing
        // ETHHelper deployment may be failing because of lack of governance router, either that or lack of wETH address.
    
        const [tweth, jweth] = await Promise.all([tDomain.network.deployWETH(), jDomain.network.deployWETH()]);
        tDomain.network.setWETH(tweth);
        jDomain.network.setWETH(jweth);
        
        log.info(await le.deploy());
        
        await le.upAgents();
        // warning: nokathy. 
    
        log.info(`Agents up`);

    }

    beforeAll(async () => {
        await setUp();
    });

    it("should handle token creation, transfer logic", async function () {
        expect(tDomain).to.not.be.undefined;
        expect(jDomain).to.not.be.undefined;
        
        const tokenFactory = getCustomToken();
        const tokenOnTom = await tDomain?.network.deployToken(
          tokenFactory,
          sender.toAddress(),
          "MyToken",
          "MTK"
        );
    
        // const tDomain = le.domain(t).name;
        
        const token: TokenIdentifier = {
          domain: tDomain.network.name,
          id: tokenOnTom.address,
        };
        assert.exists(tokenFactory);
        assert.exists(tokenOnTom);
        assert.exists(token);

        log.info(`Tokenfactory, token deployed:`, tokenOnTom.address);

        const ctx = le.getBridgeSDK();
        assert.exists(ctx);
        log.info(`Initialized Bridge SDK context`);
    
        // Default multiprovider comes with signer (`o.setSigner(jerry, signer);`) assigned
        // to each domain, but we change it to allow sending from different signer
        ctx.registerWalletSigner(tDomain.name, sender.toString());
        ctx.registerWalletSigner(jDomain.name, receiver.toString());
        console.log(`registered wallet signers for tom and jerry`);
    
        // get 3 random amounts which will be bridged
        const amount1 = getRandomTokenAmount();
        const amount2 = getRandomTokenAmount();
        const amount3 = getRandomTokenAmount();
        assert.exists(amount1);
        assert.exists(amount2);
        assert.exists(amount3);
        log.info(`Preparation done`);

        expect(await sendTokensAndConfirm(le, tDomain, jDomain, token, receiver.toAddress(), [
          amount1,
          amount2,
          amount3,
        ], log));
    
        log.info(`Sent tokens A->B done`);

        const tokenContract = await sendTokensAndConfirm(
          le,
          jDomain,
          tDomain,
          token,
          new Key().toAddress(),
          [amount3, amount2, amount1], log
        );

        log.info(`Sent tokens B->A done`);

        expect(tokenContract.address.toLowerCase()).equal(token.id.toString().toLowerCase());
    });
    
    afterAll(async() => {
      await le.down();
    });
});