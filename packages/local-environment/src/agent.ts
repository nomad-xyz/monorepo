import Docker from "dockerode";

import { DockerizedActor } from "./actor";
import { EventEmitter } from "events";
import { NomadDomain } from "./domain";
import { Key } from "./keys/key";

const kathyOn = false;

export class Agents {
  updater: Agent;
  relayer: Agent;
  processor: Agent;
  watchers: Agent[];
  kathy?: Agent;
  metricsPort: number;

  constructor(domain: NomadDomain, metricsPort: number) {
    this.metricsPort = metricsPort; // metricsPort4 - 4 ports for a single argument.
    this.updater = new LocalAgent(AgentType.Updater, domain, metricsPort); // metricsPort4 - 4 ports for a single argument.
    this.relayer = new LocalAgent(AgentType.Relayer, domain, metricsPort + 1); // metricsPort4 - 4 ports for a single argument.
    this.processor = new LocalAgent(
      AgentType.Processor,
      domain,
      metricsPort + 2
    ); // metricsPort4 - 4 ports for a single argument.
    this.watchers = [
      new LocalAgent(AgentType.Watcher, domain, metricsPort + 3),
    ]; // metricsPort4 - 4 ports for a single argument.
    if (kathyOn) this.kathy = new LocalAgent(AgentType.Kathy, domain, metricsPort + 4);
  }

  async upAll(agentType?: string) {
    await Promise.all([
      this.relayer.connect().then(() => this.relayer.start()),
      this.updater.connect().then(() => this.updater.start()),
      this.processor.connect().then(() => this.processor.start()),
      ...(kathyOn ? [this.kathy!.connect().then(() => this.kathy!.start())] : []),
      ...this.watchers.map((watcher) =>
        watcher.connect().then(() => watcher.start())
      ),
    ]);
    if (agentType) {
      switch (agentType!.toLowerCase()) {
        case "watcher":
          return this.watchers.map((w) => w.stop());
        case "kathy":
          return this.kathy!.stop();
      }
    }
  }

  async downAll() {
    await Promise.all([
      this.relayer.down(),
      this.updater.down(),
      this.processor.down(),
      ...(kathyOn ? [this.kathy!.down()] : []),
      ...this.watchers.map((w) => w.down()),
    ]);
  }

  async isAllUp() {
    const ups = await Promise.all([
      this.relayer.status(),
      this.updater.status(),
      this.processor.status(),
      ...(kathyOn ? [this.kathy!.status()] : []),
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

// export function agentTypeToString(t: string | AgentType): string {
//   if (typeof t === "string") {
//     return t.toLowerCase();
//   } else {
//     switch (t) {
//       case AgentType.Updater:
//         return "updater";
//       case AgentType.Relayer:
//         return "relayer";
//       case AgentType.Processor:
//         return "processor";
//       case AgentType.Watcher:
//         return "watcher";
//       case AgentType.Kathy:
//         return "kathy";
//     }
//   }
// }

export class LocalAgent extends DockerizedActor implements Agent {
  agentType: AgentType;
  domain: NomadDomain;
  metricsPort: number;

  constructor(agentType: AgentType, domain: NomadDomain, metricsPort: number) {
    agentType = parseAgentType(agentType);
    super(`${agentType}_${domain.network.name}`, "agent");
    this.agentType = agentType;

    this.domain = domain;

    this.metricsPort = metricsPort;
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

  async createContainer(): Promise<Docker.Container> {
    const name = this.containerName();

    const agentConfigPath = "" + process.cwd() + "/output/test_config.json";

    const additionalEnvs = this.getAdditionalEnvs();

    // const additionalEnvs = this.getAdditionalEnvs();

    // docker run --name $1_$2_agent --env RUN_ENV=main --restart=always --network="host" --env BASE_CONFIG=$1_config.json -v $(pwd)/../../rust/config:/app/config -d gcr.io/nomad-xyz/nomad-agent ./$2
    return this.docker.createContainer({
      Image: "gcr.io/nomad-xyz/nomad-agent:prestwich-remove-deploy-gas",
      name,
      Cmd: ["./" + this.agentType],
      Env: [
        `AGENT_HOME_NAME=${this.domain.network.name}`,
        `TOM_CONNECTION_URL=http://localhost:1337`,
        `JERRY_CONNECTION_URL=http://localhost:1338`,
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
