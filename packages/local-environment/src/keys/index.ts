import { AgentType } from "../agent";
import { Key } from "./key";

export interface IAgentKeysInput {
  signer: string | undefined;
  updater: string | undefined;
  watchers: string[];
  relayer: string | undefined;
  kathy: string | undefined;
  processor: string | undefined;
}

export interface IAgentKeysOutput {
  signer: string;
  updater: string;
  watchers: string[];
  relayer: string;
  kathy: string;
  processor: string;
}

export class AgentKeys {
  signer: Key;
  updater: Key;
  watchers: Key[];
  relayer: Key;
  kathy: Key;
  processor: Key;

  constructor(keys?: IAgentKeysInput) {
    this.signer = new Key(keys?.signer || DefaultAgentKeys.signer);
    this.updater = new Key(keys?.updater || DefaultAgentKeys.updater);
    this.relayer = new Key(keys?.relayer || DefaultAgentKeys.relayer);
    this.kathy = new Key(keys?.kathy || DefaultAgentKeys.kathy);
    this.processor = new Key(keys?.processor || DefaultAgentKeys.processor);
    this.watchers = keys?.watchers.map((w) => new Key(w)) || [
      new Key(DefaultAgentKeys.watcher),
    ];
  }

  get array(): Key[] {
    return [
      this.signer,
      this.updater,
      this.relayer,
      this.kathy,
      this.processor,
      ...this.watchers,
    ];
  }

  toObject(): IAgentKeysOutput {
    return {
      signer: this.signer.toString(),
      updater: this.updater.toString(),
      watchers: this.watchers.map((w) => w.toString()),
      relayer: this.relayer.toString(),
      kathy: this.kathy.toString(),
      processor: this.processor.toString(),
    };
  }

  fromObject(input: IAgentKeysInput): AgentKeys {
    return new AgentKeys(input);
  }

  getAgentKey(type?: AgentType | "signer", watcherNumber = 0): Key {
    if (!type) return this.signer;
    switch (type) {
      case AgentType.Updater:
        return this.updater;
      case AgentType.Relayer:
        return this.relayer;

      case AgentType.Processor:
        return this.processor;

      case AgentType.Watcher:
        if (this.watchers.length < watcherNumber + 1)
          throw new Error(`There is no watcher key [${watcherNumber}]`);
        return this.watchers[watcherNumber];

      case AgentType.Kathy:
        return this.kathy;

      default: // signer
        return this.signer;
    }
  }

  getAgentAddress(type: AgentType | "signer", watcherNumber = 0): string {
    return this.getAgentKey(type, watcherNumber).toAddress();
  }

  // TODO: make setters
  // TODO: make watchers named
}

export enum DefaultAgentKeys {
  signer = "1337000000000000000000000000000000000000000000000000000000001337",
  updater = "1000000000000000000000000000000000000000000000000000000000000001",
  processor = "2000000000000000000000000000000000000000000000000000000000000002",
  relayer = "3000000000000000000000000000000000000000000000000000000000000003",
  kathy = "4000000000000000000000000000000000000000000000000000000000000004",
  watcher = "5000000000000000000000000000000000000000000000000000000000000005",
}
