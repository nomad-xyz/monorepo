import Dockerode from "dockerode";
import bunyan from "bunyan";
import { EventEmitter } from "events";
import { StreamMatcher } from "./utils";

class DockerEmitter extends EventEmitter {
  unsubscribe() {
    this.removeAllListeners();
  }
}

export abstract class Actor {
  name: string;
  actorType: string;

  constructor(name: string, actorType: string) {
    this.name = name;
    this.actorType = actorType;
  }

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
}

export abstract class DockerizedActor extends Actor {
  
  docker: Dockerode;
  container?: Dockerode.Container;
  events: DockerEmitter;
  private eventsStream?: NodeJS.ReadableStream;
  logMatcher?: StreamMatcher;

  log = bunyan.createLogger({ name: "localenv" });

  constructor(name: string, actorType: string, docker?: Dockerode) {
    super(name, actorType);
    this.docker = docker || new Dockerode();
    this.events = new DockerEmitter();
  }

  containerName(): string {
    return `${this.name}_${this.actorType}`;
  }

  isConnected(): boolean {
    return !!this.container;
  }

  async isRunning(): Promise<boolean>{
    const inspect = await this.container?.inspect();
    return !!inspect && inspect.State.Running;
  }

  async start(): Promise<void> {
    if (!this.isConnected()) throw new Error(`Not connected`);
    if (await this.isRunning()) return;

    await this.container?.start();

    return;
  }

  async stop(): Promise<void> {
    if (!this.isConnected()) throw new Error(`Not connected`);
    if (!(await this.isRunning())) {
      this.log.info(`Attempted to stop container that is NOT running, proceeding without action`);
    } else {
      if (this.container) {
        const containerId = this.container.id;
        const containerInfo = await this.container.inspect();
        this.log.info(`Attempting to stop container that IS running, container id:`, containerId, containerInfo.Name);
        try {
          await this.container.stop();
          this.log.info(`Successfully stopped container with id '${containerId}'`);
        } catch(e) {
          this.log.info(`Failed stopping container with id '${containerId}'! Error:`, e);
          throw e;
        }
      }
    }
    return;
  }


  async up(): Promise<void> {
    await this.connect();
    await this.start(); 
  }

  async down(): Promise<void> {
    if (this.isConnected()) {
      await this.stop();
      this.unsubscribe();
      await this.removeContainer();
    }
  }

  async removeContainer(): Promise<void> {
    await this.container?.remove();

    delete this.container;
   }

  async connect(): Promise<boolean> {
    const containerId = await this.findContainerIdByName(this.containerName());

    let created: boolean;

    if (containerId) {
      this.container = this.docker.getContainer(containerId);
      created = false;
    } else {
      this.container = await this.createContainer();
      created = true;
    }

    return created;
  }

  isLogMatcherAttached(): boolean {
    return !!this.logMatcher;
  }

  attachLogMatcher(): void {
    if (this.isLogMatcherAttached()) return;
    if (!this.container) throw new Error(`Container doesnt exist yet!`);

    this.logMatcher = new StreamMatcher();

    this.container?.attach(
      { stream: true, stdout: true, stderr: true },
      (err, stream) => {
        if (stream) {
          if (this.logMatcher) {
            stream.pipe(this.logMatcher);
          }
        }
      }
    );
  }

  registerAllLogEvents(): void {
    this.logMatcherRegisterEvent(
      "info_messages",
      /INFO".+"message":"([^"]+)/
    );
  }

  detachLogMatcher(): void {
    this.logMatcher?.end();
  }

  logMatcherRegisterEvent(eventName: string, pattern: RegExp): void {
    if (!this.logMatcher) throw new Error(`No LogMatcher is attached`);
    this.logMatcher.register(pattern, (match) => {
      this.events.emit(`logs.${eventName}`, match);
    });
  }

  unsubscribeFromContainerEvents(): void {
    if (this.isSubscribed()) {
      this.eventsStream?.emit("end");

      delete this.eventsStream;
    }
  }

  async subscribeToContainerEvents(): Promise<void> {
    if (!this.isConnected()) throw new Error('Container is not connected');
    if (this.isSubscribed()) return;

    const events = await this.docker.getEvents({
      filters: {
        container: [this.containerName()],
      },
    });

    events.on("data", (data: Buffer) => {
      const event: DockerEvent = JSON.parse(data.toString("utf8"));
      switch (event.Action) {
        case "start":
          this.events?.emit("start");
          break;
        case "stop":
          this.events?.emit("stop");
          break;
        case "restart":
          this.events?.emit("restart");
          break;
      }
    });

    this.eventsStream = events;
  }

  unsubscribe(): void {
    this.detachLogMatcher(); // should be here?
    this.events.unsubscribe();
    this.unsubscribeFromContainerEvents();
  }

  async disconnect(): Promise<void> {
    try {
      await this.container?.remove();
    } catch(_) {
      // do nothing
    }
    
    this.unsubscribe(); // Want to unsub later because want to see event of container removal
    delete this.container;
  }

  private isSubscribed(): boolean {
    return !!this.eventsStream;
  }

  private async findContainerIdByName(
    name: string
  ): Promise<string | undefined> {
    let containers = await this.docker.listContainers({
      all: true,
    });

    containers = containers.filter((c) =>
      c.Names.some((n) => n === `/${name}`)
    );

    return containers[0]?.Id;
  }

  abstract createContainer(): Promise<Dockerode.Container>;

  async getEvents(): Promise<EventEmitter> {
    await this.subscribeToContainerEvents();
    this.attachLogMatcher();
    this.registerAllLogEvents();
    return this.events;
  }
}

interface DockerActorAttributes {
  image?: string;
  container: string;
  name: string;
}

interface DockerEventActor {
  ID: string;
  Attributes: DockerActorAttributes;
}
interface DockerEvent {
  status?: string;
  Type: string;
  Action: string;
  Actor: DockerEventActor;
  time: number;
}
