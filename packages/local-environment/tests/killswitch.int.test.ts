import {expect} from "chai";
import {Key} from "../src/keys/key";
import {NomadDomain} from "../src/domain";
import {NomadEnv} from "../src/nomadenv";
import {DockerizedBinary} from "../src/binary";
import {AgentType} from "../src/agent";


describe("killswitch tests", () => {

    const agentsImage = process.env.AGENTS_IMAGE;
    const agentConfigPath = "" + process.cwd() + "/output/test_config.json";

    let tom;
    let jerry;
    let env;
    let senderKey;
    let receiverKey;
    let bridgeCtx;
    let tomXcm;
    let jerryXcm;
    let tomReplica;
    let jerryReplica;

    const makeKillswitch = (
        config_var = 'CONFIG_PATH=/app/config/test_config.json',
        set_add_vars = true
    ): DockerizedBinary => {
        const additionalEnvVar = (env && env.domains.flatMap((d) => {
            const name = d.domain.name.toUpperCase();
            return [
                `${name}_CONNECTION_URL=${d.rpcs[0]}`,
                `${name}_TXSIGNER_KEY=${d.getAgentSigner(AgentType.Watcher).toString()}`,
                `${name}_ATTESTATION_SIGNER_KEY=${d.getAgentSigner().toString()}`,
            ];
        })) || [];
        return new DockerizedBinary(
            agentsImage!,
            {
                Env: [
                    `RUST_BACKTRACE=FULL`,
                    config_var,
                    `DEFAULT_RPCSTYLE=ethereum`,
                    `DEFAULT_SUBMITTER_TYPE=local`,
                    ...(set_add_vars ? additionalEnvVar : []),
                ],
                HostConfig: {
                    Mounts: [
                        {
                            Target: "/app/config/test_config.json",
                            Source: agentConfigPath,
                            Type: "bind",
                        },
                    ],
                    NetworkMode: "host",
                },
            }
        );
    };

    const setupBridge = async () => {

        env = new NomadEnv({domain: 1, id: '0x'+'20'.repeat(20)});
        tom = NomadDomain.newHardhatNetwork("tom", 1, { forkurl: `${process.env.ALCHEMY_FORK_URL}`, weth: `${process.env.WETH_ADDRESS}`, nomadEnv: env });
        jerry = NomadDomain.newHardhatNetwork("jerry", 2, { forkurl: `${process.env.ALCHEMY_FORK_URL}`, weth: `${process.env.WETH_ADDRESS}`, nomadEnv: env });
        const tDomain = env.addNetwork(tom.network);
        const jDomain = env.addNetwork(jerry.network);
        
        tDomain.connectDomain(jDomain);

        senderKey = new Key();
        receiverKey = new Key();

        tDomain.network.addKeys(senderKey);
        jDomain.network.addKeys(receiverKey);

        await env.upNetworks();

        const [tweth, jweth] = await Promise.all([tDomain.network.deployWETH(), jDomain.network.deployWETH()]);
        tDomain.network.setWETH(tweth);
        jDomain.network.setWETH(jweth);

        await env.deploy();
        await env.upAgents();

        bridgeCtx = env.getBridgeSDK();
        tomXcm = bridgeCtx.getCore(tom.name).xAppConnectionManager;
        jerryXcm = bridgeCtx.getCore(jerry.name).xAppConnectionManager;
        tomReplica = bridgeCtx.getReplicaFor(tom.name, jerry.name);
        jerryReplica = bridgeCtx.getReplicaFor(jerry.name, tom.name);
    };

    it('should return a bad config file error', async () => {

        const killswitch = makeKillswitch('CONFIG_PATH=/some/bad/config/path.json');
        const cmd = ['./killswitch', '--environment', 'already-set', '--app', 'token-bridge', '--all'];
        const output = await killswitch.run(cmd);

        expect(output).to.match(/BadConfigVar: Unable to load config/);
    });

    it('should preflight successfully', async () => {

        const killswitch = makeKillswitch();
        const cmd = ['./killswitch', '--environment', 'already-set', '--app', 'token-bridge', '--all'];
        const output = await killswitch.run(cmd);

        expect(output).to.match(/\[CHANNEL] jerry -> tom/);
        expect(output).to.match(/\[CHANNEL] tom -> jerry/);
        expect(output).to.match(/\[NOTICE] Nothing killed!/);
    });

    it('should unenroll all replicas', async () => {

        await setupBridge();

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.true;

        const killswitch = makeKillswitch();
        const cmd = ['./killswitch', '--environment', 'already-set', '--app', 'token-bridge', '--all', '--force'];
        const output = await killswitch.run(cmd);

        expect(output).to.match(/\[CHANNEL] jerry -> tom\r?\n\[SUCCESS]/);
        expect(output).to.match(/\[CHANNEL] tom -> jerry\r?\n\[SUCCESS]/);

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.false;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.false;
    });

    it('should unenroll all replicas on jerry', async () => {

        await setupBridge();

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.true;

        const killswitch = makeKillswitch();
        const cmd = ['./killswitch', '--environment', 'already-set', '--app', 'token-bridge', '--all-inbound', 'jerry', '--force'];
        const output = await killswitch.run(cmd);

        expect(output).to.match(/\[CHANNEL] tom -> jerry\r?\n\[SUCCESS]/);

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.false;
    });

    afterEach( async () => {
        env && await env.down();
        env = null;
    });
});