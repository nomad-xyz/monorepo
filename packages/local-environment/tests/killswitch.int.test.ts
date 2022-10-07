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

    const killswitchOutputToJson = (output: string) => {
        const chunks = output
            .split('\r\n')
            .filter((s) => s.length)
            .join(',');
        return JSON.parse(`[${chunks}]`);
    };

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
        env.addNetwork(tom.network);
        env.addNetwork(jerry.network);
        
        env.tDomain?.connectDomain(env.jDomain!);

        senderKey = new Key();
        receiverKey = new Key();

        env.tDomain?.network.addKeys(senderKey);
        env.jDomain?.network.addKeys(receiverKey);

        await env.upNetworks();

        const [tweth, jweth] = await Promise.all([env.tDomain?.network.deployWETH(), env.jDomain?.network.deployWETH()]);
        env.tDomain?.network.setWETH(tweth);
        env.jDomain?.network.setWETH(jweth);

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
        const cmd = ['./killswitch', '--app', 'token-bridge', '--all'];
        const json = await killswitch.run(cmd).then(killswitchOutputToJson);

        expect(json[0].message.result.status).to.equal('error');
        expect(json[0].message.result.message).to.match(/^BadConfigVar:/);
    });

    it('should return missing rpc and signer errors', async () => {

        const killswitch = makeKillswitch(undefined, false);
        const cmd = ['./killswitch', '--app', 'token-bridge', '--all'];
        const json = await killswitch.run(cmd).then(killswitchOutputToJson);

        const homes = json[0].message.homes;
        expect(homes.tom.status).to.equal('error');
        expect(homes.jerry.status).to.equal('error');
        const tomJerryResult = homes.tom.message.replicas.jerry.result;
        const jerryTomResult = homes.jerry.message.replicas.tom.result;
        expect(tomJerryResult.status).to.equal('error');
        expect(jerryTomResult.status).to.equal('error');
        expect(tomJerryResult.message[0]).to.match(/^MissingRPC:/);
        expect(jerryTomResult.message[0]).to.match(/^MissingRPC:/);
        expect(tomJerryResult.message[2]).to.match(/^MissingAttestationSignerConf:/);
        expect(jerryTomResult.message[2]).to.match(/^MissingAttestationSignerConf:/);
    });

    it('should unenroll all replicas', async () => {

        await setupBridge();

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.true;

        const killswitch = makeKillswitch();
        const cmd = ['./killswitch', '--app', 'token-bridge', '--all'];
        const json = await killswitch.run(cmd).then(killswitchOutputToJson);

        const homes = json[0].message.homes;
        expect(homes.tom.status).to.equal('success');
        expect(homes.jerry.status).to.equal('success');
        expect(homes.tom.message.replicas.jerry.result.tx_hash).to.have.lengthOf(66);
        expect(homes.jerry.message.replicas.tom.result.tx_hash).to.have.lengthOf(66);

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.false;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.false;
    });

    it('should unenroll all replicas on jerry', async () => {

        await setupBridge();

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.true;

        const killswitch = makeKillswitch();
        const cmd = ['./killswitch', '--app', 'token-bridge', '--all-inbound', 'jerry'];
        const json = await killswitch.run(cmd).then(killswitchOutputToJson);

        expect(json).to.not.be.undefined;
        const homes = json[0].message.homes;
        expect(homes.tom.status).to.equal('success');
        expect(homes.jerry).to.be.undefined;
        expect(homes.tom.message.replicas.jerry.result.tx_hash).to.have.lengthOf(66);

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.false;
    });

    afterEach( async () => {
        env && await env.down();
        env = null;
    });
});