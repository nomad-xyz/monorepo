import {expect} from "chai";
import {Key} from "../src/keys/key";
import {NomadDomain} from "../src/domain";
import {NomadEnv} from "../src/nomadenv";
import {DockerizedBinary} from "../src/binary";
import {AgentType} from "../src/agent";

import {BridgeContext} from "@nomad-xyz/sdk-bridge"

describe("updater rotation tests", () => {

    const agentsImage = process.env.AGENTS_IMAGE;
    const agentConfigPath = "" + process.cwd() + "/output/test_config.json";
    type TestVars = {
        tom: NomadDomain, 
        jerry: NomadDomain,
        env: NomadEnv,
        bridgeCtx: BridgeContext
    }

    const setupBridge = async (): Promise<TestVars> => {
        let env = new NomadEnv({domain: 1, id: '0x'+'20'.repeat(20)});
        let tom = NomadDomain.newHardhatNetwork("tom", 1, { forkurl: `${process.env.ALCHEMY_FORK_URL}`, weth: `${process.env.WETH_ADDRESS}`, nomadEnv: env });
        let jerry = NomadDomain.newHardhatNetwork("jerry", 2, { forkurl: `${process.env.ALCHEMY_FORK_URL}`, weth: `${process.env.WETH_ADDRESS}`, nomadEnv: env });
        
        const tDomain = env.addNetwork(tom.network);
        const jDomain = env.addNetwork(jerry.network);

        tDomain.connectDomain(jDomain);

        await env.upNetworks();

        const [tweth, jweth] = await Promise.all([tDomain.network.deployWETH(), jDomain.network.deployWETH()]);
        tDomain.network.setWETH(tweth);
        jDomain.network.setWETH(jweth);

        await env.deploy();
        await env.upAgents();

        let bridgeCtx = env.getBridgeSDK()

        return {
            tom,
            jerry, 
            env, 
            bridgeCtx
        }
    };

    

    it('should break agents if updater is rotated and config ise not updated', async () => {
        // Deploy Nomad
        let testVars = await setupBridge();

        let tomUpdaterManager = testVars.bridgeCtx.getCore(testVars.tom.name)?.updaterManager
        let jerryUpdaterManager = testVars.bridgeCtx.getCore(testVars.jerry.name)?.updaterManager

        await testVars.env.down()
    });

    it('should should rotate updater successfully', async () => {

        await setupBridge();
    });

    // afterEach( async () => {
    // });
});