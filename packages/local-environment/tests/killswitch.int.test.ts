import {expect} from "chai";
import bunyan from "bunyan";
import {HardhatNetwork} from "../src/network";
import {Key} from "../src/keys/key";
import {NomadDomain} from "../src/domain";
import {NomadEnv} from "../src/nomadenv";
import {DockerizedBinary} from "../src/binary";
import {AgentType} from "../src/agent";


describe("killswitch", () => {

    const log = bunyan.createLogger({name: 'localenv'});
    const agentConfigPath = "" + process.cwd() + "/output/test_config.json";

    let tom;
    let jerry;
    let tomDomain;
    let jerryDomain;
    let env;
    let bridgeCtx;
    let tomXcm;
    let jerryXcm;
    let tomReplica;
    let jerryReplica;

    const killswitchOutputToJson = (output: string) => {
        let chunks = output
            .split('\r\n')
            .filter((s) => s.length)
            .join(',');
        return JSON.parse(`[${chunks}]`)
    }

    const makeKillswitch = (
        config_var: string = 'CONFIG_PATH=/app/config/test_config.json'
    ): DockerizedBinary => {
        const additionalEnvVar = (env && env.domains.flatMap((d) => {
            let name = d.domain.name.toUpperCase();
            return [
                `${name}_CONNECTION_URL=${d.rpcs[0]}`,
                `${name}_TXSIGNER_KEY=${d.getAgentSigner(AgentType.Watcher).toString()}`,
                `${name}_ATTESTATION_SIGNER_KEY=${d.getAgentSigner().toString()}`
            ]
        })) || [];
        return new DockerizedBinary(
            process.env.AGENTS_IMAGE,
            {
                Env: [
                    `RUST_BACKTRACE=FULL`,
                    config_var,
                    `DEFAULT_RPCSTYLE=ethereum`,
                    `DEFAULT_SUBMITTER_TYPE=local`,
                    ...additionalEnvVar
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
    }

    const setupBridge = async () => {

        tom = new HardhatNetwork('tom', 1);
        jerry = new HardhatNetwork('jerry', 2);
        tomDomain = new NomadDomain(tom);
        jerryDomain = new NomadDomain(jerry);
        env = new NomadEnv({domain: tom.domainNumber, id: '0x'+'20'.repeat(20)});

        const senderKey = new Key();
        const receiverKey = new Key();

        tom.addKeys(senderKey);
        jerry.addKeys(receiverKey);
        env.addDomain(tomDomain);
        env.addDomain(jerryDomain);
        tomDomain.connectNetwork(jerryDomain);
        jerryDomain.connectNetwork(tomDomain);

        await env.upNetworks();

        const [tweth, jweth] = await Promise.all([tom.deployWETH(), jerry.deployWETH()]);
        tom.setWETH(tweth);
        jerry.setWETH(jweth);

        await env.deploy();
        await env.upAgents();

        bridgeCtx = env.getBridgeSDK();
        tomXcm = bridgeCtx.getCore(tom.name).xAppConnectionManager;
        jerryXcm = bridgeCtx.getCore(jerry.name).xAppConnectionManager;
        tomReplica = bridgeCtx.getReplicaFor(tom.name, jerry.name);
        jerryReplica = bridgeCtx.getReplicaFor(jerry.name, tom.name);
    }

    it('should return a bad config error', async () => {

        let killswitch = makeKillswitch('CONFIG_PATH=/some/bad/config/path.json');
        const cmd = ['./killswitch', '--app', 'token-bridge', '--all'];
        let json = await killswitch.run(cmd).then(killswitchOutputToJson);

        expect(json[0].message).to.match(/^BadConfigVar:/);
    })

    it('should unenroll all replicas', async () => {

        await setupBridge();

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.true;

        let killswitch = makeKillswitch();
        const cmd = ['./killswitch', '--app', 'token-bridge', '--all'];
        let json = await killswitch.run(cmd).then(killswitchOutputToJson);

        let homes = json[0].message.homes;
        expect(homes.tom.status).to.equal('success');
        expect(homes.jerry.status).to.equal('success');
        expect(homes.tom.message.replicas.jerry.result.tx_hash).to.have.lengthOf(66);
        expect(homes.jerry.message.replicas.tom.result.tx_hash).to.have.lengthOf(66);

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.false;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.false;
    })

    it('should unenroll all replicas on jerry', async () => {

        await setupBridge();

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.true;

        let killswitch = makeKillswitch();
        const cmd = ['./killswitch', '--app', 'token-bridge', '--all-inbound', 'jerry'];
        let json = await killswitch.run(cmd).then(killswitchOutputToJson);

        expect(json).to.not.be.undefined;
        let homes = json[0].message.homes;
        expect(homes.tom.status).to.equal('success');
        expect(homes.jerry).to.be.undefined;
        expect(homes.tom.message.replicas.jerry.result.tx_hash).to.have.lengthOf(66);

        expect(await tomXcm.isReplica(jerryReplica.address)).to.be.true;
        expect(await jerryXcm.isReplica(tomReplica.address)).to.be.false;
    })

    afterEach( async () => {
        env && await env.down();
        env = null;
    })
})