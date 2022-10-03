import Dockerrode from "dockerode";

import { DockerizedActor } from "./actor";
import { EventEmitter } from "events";
import { NomadDomain } from "./domain";
import { NomadEnv } from "./nomadenv";

const kathyOn = false;
const agentsImage = process.env.AGENTS_IMAGE || "gcr.io/nomad-xyz/nomad-agent:prestwich-remove-deploy-gas";

export class Agents {
  updater: Agent;
  relayer: Agent;
  processor: Agent;
  watchers: Agent[];
  kathy?: Agent;
  metricsPort: number;
  docker: Dockerrode;

  constructor(domain: NomadDomain, metricsPort: number, docker: Dockerrode) {
    this.metricsPort = metricsPort; // metricsPort4 - 4 ports for a single argument.
    this.docker = docker;
    this.updater = new LocalAgent(AgentType.Updater, domain, metricsPort, docker); // metricsPort4 - 4 ports for a single argument.
    this.relayer = new LocalAgent(AgentType.Relayer, domain, metricsPort + 1, docker); // metricsPort4 - 4 ports for a single argument.
    this.processor = new LocalAgent(
      AgentType.Processor,
      domain,
      metricsPort + 2,
      docker
    ); // metricsPort4 - 4 ports for a single argument.
    this.watchers = [
      new LocalAgent(AgentType.Watcher, domain, metricsPort + 3, docker),
    ]; // metricsPort4 - 4 ports for a single argument.
    if (kathyOn) this.kathy = new LocalAgent(AgentType.Kathy, domain, metricsPort + 4, docker);
  }

  async upAll(agentType?: string): Promise<void | Promise<void>[] > {
    await Promise.all([
      this.relayer.up(),
      this.updater.up(),
      this.processor.up(),
      ...(kathyOn ? [this.kathy?.up()] : []),
      ...this.watchers.map((watcher) => watcher.up()),
    ]);
    if (agentType) {
      switch (agentType.toLowerCase()) {
        case "watcher":
          return this.watchers.map((w) => w.stop());
        case "kathy":
          return this.kathy?.stop();
      }
    }
  }

  async downAll(): Promise<void> {
    await Promise.all([
      this.relayer.down(),
      this.updater.down(),
      this.processor.down(),
      ...(kathyOn ? [this.kathy?.down()] : []),
      ...this.watchers.map((w) => w.down()),
    ]);
  }

  async isAllUp(): Promise<boolean> {
    const ups = await Promise.all([
      this.relayer.status(),
      this.updater.status(),
      this.processor.status(),
      ...(kathyOn ? [this.kathy?.status()] : []),
      ...this.watchers.map((w) => w.status()),
    ]);
    return ups.every(a => a);
  }
}

export interface Agent {
  agentType: AgentType;
  domain: NomadDomain;

  connect(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  up(): Promise<void>;
  down(): Promise<void>;
  disconnect(): Promise<void>;
  getEvents(): Promise<EventEmitter>;
  unsubscribe(): void;
  status(): Promise<boolean>;
}

export enum AgentType {
  Updater = "updater",
  Relayer = "relayer",
  Processor = "processor",
  Watcher = "watcher",
  Kathy = "kathy",
}

function parseAgentType(t: string | AgentType): AgentType {
  if (typeof t === "string") {
    switch (t.toLowerCase()) {
      case "updater":
        return AgentType.Updater;
      case "relayer":
        return AgentType.Relayer;
      case "processor":
        return AgentType.Processor;
      case "watcher":
        return AgentType.Watcher;
      case "kathy":
        return AgentType.Kathy;
    }
    throw new Error(`Agent type is not recognized`);
  } else {
    return t;
  }
}

export class LocalAgent extends DockerizedActor implements Agent {
  agentType: AgentType;
  domain: NomadDomain;
  metricsPort: number;
  nomadEnv?: NomadEnv;
  
  constructor(agentType: AgentType, domain: NomadDomain, metricsPort: number, docker: Dockerrode) {
    agentType = parseAgentType(agentType);
    super(`${agentType}_${domain.network.name}`, "agent", docker);
    this.agentType = agentType;

    this.domain = domain;

    this.metricsPort = metricsPort;
    this.nomadEnv = nomadEnv;
  }

  containerName(): string {
    return `${this.name}_${this.actorType}`;
  }
  /*
  setSigner(network: Network, key: Key, agentType?: string | AgentType) {
     const domain = network.domainNumber;
     if (domain) {
       if (agentType) {
         const mapKey = `${agentType.toLowerCase()}_${domain}`;
         network.signers.set(mapKey, key);
       } else {
         network.signers.set(domain, key);
       }
     }
   }
   */
  /*
   setUpdater(network: Network, key: Key) {
     const domain = network.domainNumber;
     if (domain) network.updaters.set(domain, key);
   }
   setWatcher(network: Network, key: Key) {
    const domain = network.domainNumber;
    if (domain) network.watchers.set(domain, key);
  }
  */
  /*
  getSignerKey(
    network: Network,
    agentType?: string | AgentType
   ): Key | undefined {
     const domain = network.domainNumber;
     if (domain) {
       if (agentType) {
         const mapKey = `${agentType.toLowerCase()}_${domain}`;
         return network.signers.get(mapKey);
       } else {
         return network.signers.get(domain);
       }
     }
     return undefined;
   }
   */
  /*
  getUpdaterKey(network: Network): Key | undefined {
     const domain = network.domainNumber;
     if (domain) return network.updaters.get(domain);
     return undefined; //RETURN HARDCODED
   }
   getWatcherKey(network: Network): Key | undefined {
     const domain = network.domainNumber;
     if (domain) return network.watchers.get(domain);
     return undefined;
   }
 */

  //Let's use the network key-add logic here for default signer keys.

  getAdditionalEnvs(): string[] {
    const envs: Array<any> = [];
    //Hardcoded, HRE generated TX SIGNER KEYS unique to each agent, same on multiple networks.
    switch (this.agentType) {
      case AgentType.Updater: {
        envs.push(
          `DEFAULT_TXSIGNER_KEY=0x${this.domain
            .getAgentSigner(AgentType.Updater)
            .toString()}` //Gets the key after LE assigns off of domainNumber.
        );
        envs.push(
          `ATTESTATION_SIGNER_KEY=0x${this.domain.getAgentSigner().toString()}`
        ); //Important that all agents have unique TXSIGNER keys, but not attestation. Updater uses this key to sign merkle-root transitions.
        break;
      }
      case AgentType.Watcher: {
        envs.push(
          `DEFAULT_TXSIGNER_KEY=0x${this.domain
            .getAgentSigner(AgentType.Watcher)
            .toString()}`
        );
        envs.push(
          `ATTESTATION_SIGNER_KEY=0x${this.domain.getAgentSigner().toString()}`
        ); //Watchers use this key to sign attestations of fraudulent roots.
        break;
      }
      case AgentType.Relayer: {
        envs.push(
          `DEFAULT_TXSIGNER_KEY=0x${this.domain
            .getAgentSigner(AgentType.Relayer)
            .toString()}`
        );
        break;
      }
      case AgentType.Kathy: {
        envs.push(
          `DEFAULT_TXSIGNER_KEY=0x${this.domain
            .getAgentSigner(AgentType.Kathy)
            .toString()}`
        );
        break;
      }
      case AgentType.Processor: {
        envs.push(
          `DEFAULT_TXSIGNER_KEY=0x${this.domain
            .getAgentSigner(AgentType.Processor)
            .toString()}`
        );
        break;
      }
    }

    return envs;
  }

  async createContainer(): Promise<Dockerrode.Container> {
    const name = this.containerName();

    const agentConfigPath = "" + process.cwd() + "/output/test_config.json";

    const additionalEnvs = this.getAdditionalEnvs();

    const connectionUrls = this.nomadEnv?.domains.map(d => `${d.domain.name.toUpperCase()}_CONNECTION_URL=${d.rpcs[0]}`) || [];

    // docker run --name $1_$2_agent --env RUN_ENV=main --restart=always --network="host" --env BASE_CONFIG=$1_config.json -v $(pwd)/../../rust/config:/app/config -d gcr.io/nomad-xyz/nomad-agent ./$2
    return this.docker.createContainer({
      Image: agentsImage,
      name,
      Cmd: ["./" + this.agentType],
      Env: [
        `AGENT_HOME_NAME=${this.domain.network.name}`,
        ...connectionUrls,
        `METRICS_PORT=${this.metricsPort}`,
        `CONFIG_PATH=/app/config/test_config.json`,
        `RUST_BACKTRACE=FULL`,
        `AGENT_REPLICAS_ALL=true`,
        `DEFAULT_RPCSTYLE=ethereum`,
        `DEFAULT_SUBMITTER_TYPE=local`,
        // ${this.network.domain.connections[0]}
        ...additionalEnvs,
      ],
      HostConfig: {
        Mounts: [
          {
            Target: "/app/config/test_config.json",
            Source: agentConfigPath,
            Type: "bind",
          },
        ],
        RestartPolicy: {
          Name: "always",
        },
        NetworkMode: "host", //Set up portmapping for agent containers. We also need to set up portmappping for hardhat network containers
        // AutoRemove: true,
      },
    });
  }

  async status(): Promise<boolean> {
    return this.isRunning();
  }
}
