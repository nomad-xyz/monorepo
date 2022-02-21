import Docker from "dockerode";

import { DockerizedActor } from "./actors";
import { Network } from "./network";
import { Nomad } from "./nomad";
import { EventEmitter } from "events";

export interface Agent {
  agentType: AgentType;
  network: Network;
  nomad: Nomad;

  connect(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  disconnect(): Promise<void>;
  getEvents(): Promise<EventEmitter>;
  unsubscribe(): void;
  status(): void;
}

export enum AgentType {
  Updater,
  Relayer,
  Processor,
  Watcher,
  Kathy,
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

export function agentTypeToString(t: string | AgentType): string {
  if (typeof t === "string") {
    return t.toLowerCase();
  } else {
    switch (t) {
      case AgentType.Updater:
        return "updater";
      case AgentType.Relayer:
        return "relayer";
      case AgentType.Processor:
        return "processor";
      case AgentType.Watcher:
        return "watcher";
      case AgentType.Kathy:
        return "kathy";
    }
  }
}

export class LocalAgent extends DockerizedActor implements Agent {
  agentType: AgentType;
  network: Network;
  nomad: Nomad;

  constructor(agentType: string | AgentType, network: Network, nomad: Nomad) {
    agentType = parseAgentType(agentType);
    super(`${agentTypeToString(agentType)}_${network.name}`, "agent");
    this.agentType = agentType;

    this.network = network;
    this.nomad = nomad;
  }

  containerName(): string {
    return `${this.name}_${this.actorType}_${this.nomad.id}`;
  }

  getAdditionalEnvs(): string[] {
    const envs = [];

    this.nomad.getNetworks().forEach((network) => {
      const signer = this.nomad.getSignerKey(network, this.agentType);

      if (signer) {
        const name = network.name.toUpperCase();
        const agentTypeUpperStr = agentTypeToString(
          this.agentType
        ).toUpperCase();

        envs.push(
          `OPT_${agentTypeUpperStr}_SIGNERS_${name}_KEY=${signer.toString()}`
        );
        envs.push(`OPT_${agentTypeUpperStr}_SIGNERS_${name}_TYPE=hexKey`);
      }
    });

    switch (this.agentType) {
      case AgentType.Updater: {
        const key = this.nomad.getUpdaterKey(this.network);
        if (key) envs.push(`OPT_UPDATER_UPDATER_KEY=${key.toString()}`);
        break;
      }
      case AgentType.Watcher: {
        const key = this.nomad.getWatcherKey(this.network);
        if (key) envs.push(`OPT_WATCHER_WATCHER_KEY=${key.toString()}`);
        break;
      }
    }

    return envs;
  }

  async createContainer(): Promise<Docker.Container> {
    const name = this.containerName();

    const agentConfigPath = this.nomad.defultDeployLocation();

    const additionalEnvs = this.getAdditionalEnvs();

    // docker run --name $1_$2_agent --env RUN_ENV=latest --restart=always --network="host" --env BASE_CONFIG=$1_config.json -v $(pwd)/../../rust/config:/app/config -d gcr.io/nomad-xyz/nomad-agent ./$2
    return this.docker.createContainer({
      Image: "gcr.io/nomad-xyz/nomad-agent",
      name,
      Cmd: ["./" + agentTypeToString(this.agentType)],
      Env: [
        "RUN_ENV=latest",
        `BASE_CONFIG=${this.network.name}_config.json`,
        ...additionalEnvs,
      ],
      HostConfig: {
        Mounts: [
          {
            Target: "/app/config",
            Source: agentConfigPath,
            Type: "bind",
          },
        ],
        RestartPolicy: {
          Name: "always",
        },
        NetworkMode: "host",
        // AutoRemove: true,
      },
    });
  }

  status() {}
}
