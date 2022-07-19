import Docker from "dockerode";

import { DockerizedActor } from "./actor";
import { EventEmitter } from "events";
import { Network } from "./network";
import { Env } from "./le";

export class Agents {
  updater: Agent;
  relayer: Agent;
  processor: Agent;
  watchers: Agent[];
  kathy: Agent;

  constructor(network: Network, env: Env, metricsPort: number) {
      this.updater = new LocalAgent(AgentType.Updater, network, env, metricsPort);
      this.relayer = new LocalAgent(AgentType.Relayer, network, env, metricsPort+1);
      this.processor = new LocalAgent(AgentType.Processor, network, env, metricsPort+2);
      this.watchers = [new LocalAgent(AgentType.Watcher, network, env, metricsPort+3)];
      this.kathy = new LocalAgent(AgentType.Kathy, network, env, metricsPort+4);
  }
}

export interface Agent {
  agentType: AgentType;
  network: Network;

  connect(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  disconnect(): Promise<void>;
  getEvents(): Promise<EventEmitter>;
  unsubscribe(): void;
  status(): void;
}

export enum AgentType {
  Updater = 'updater',
  Relayer = 'relayer',
  Processor = 'processor',
  Watcher = 'watcher',
  Kathy = 'kathy',
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
  network: Network;
  env: Env;
  metricsPort: number;

  constructor(agentType: AgentType, network: Network, env: Env, metricsPort: number) {
    agentType = parseAgentType(agentType);
    super(`${agentType}_${network.name}`, "agent");
    this.agentType = agentType;

    this.network = network;

    this.env = env;

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
  //@TODO! MAKE THIS SECTION WORKING, ALSO MAKE SURE YOUR DOCKER INCLUDES THE ENV VARIABLES FROM https://github.com/nomad-xyz/rust/blob/main/fixtures/env.external

  getAdditionalEnvs(): string[] {
    const envs: Array<any> = [];
    //Hardcoded, HRE generated TX SIGNER KEYS unique to each agent, same on multiple networks.
     switch (this.agentType) {
      case AgentType.Updater: {
         envs.push(
            `DEFAULT_TXSIGNER_KEY=0x1000000000000000000000000000000000000000000000000000000000000001`  
         );
         envs.push(`ATTESTATION_SIGNER_KEY=0x1000000000000000000000000000000000000000000000000000000000000001`); //Important that all agents have unique TXSIGNER keys, but not attestation. Updater uses this key to sign merkle-root transitions.
         break;
       }
      case AgentType.Watcher: {
        envs.push(`DEFAULT_TXSIGNER_KEY=0x2000000000000000000000000000000000000000000000000000000000000002`);
        envs.push(`ATTESTATION_SIGNER_KEY=0x1000000000000000000000000000000000000000000000000000000000000001`); //Watchers use this key to sign attestations of fraudulent roots.
        break;
      }
      case AgentType.Relayer: {
        envs.push(`DEFAULT_TXSIGNER_KEY=0x3000000000000000000000000000000000000000000000000000000000000003`);
        break;
      }
      case AgentType.Kathy: {
        envs.push(`DEFAULT_TXSIGNER_KEY=0x4000000000000000000000000000000000000000000000000000000000000004`);
        break;
      }
      case AgentType.Processor: {
        envs.push(`DEFAULT_TXSIGNER_KEY=0x5000000000000000000000000000000000000000000000000000000000000005`);
        break;
      }
     };

     return envs;
   }

  async createContainer(): Promise<Docker.Container> {
    const name = this.containerName();

    const agentConfigPath = '' + process.cwd() + '/output/test_config.json';

    const additionalEnvs = this.getAdditionalEnvs();

    // const additionalEnvs = this.getAdditionalEnvs();

    // docker run --name $1_$2_agent --env RUN_ENV=main --restart=always --network="host" --env BASE_CONFIG=$1_config.json -v $(pwd)/../../rust/config:/app/config -d gcr.io/nomad-xyz/nomad-agent ./$2
    return this.docker.createContainer({
      Image: "gcr.io/nomad-xyz/nomad-agent:prestwich-remove-deploy-gas",
      name,
      Cmd: ["./" + this.agentType],
      Env: [
        `AGENT_HOME_NAME=${this.network.name}`,
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

  status() {}
}
