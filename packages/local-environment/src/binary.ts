import Docker from "dockerode";
import stream from "stream";

/**
 * `DockerizedBinary` allows a single command to be run
 * in a docker container and returns the result
 */
export class DockerizedBinary {

    private docker: Docker;
    private dockerImage: string
    private containerOptions: Docker.ContainerCreateOptions;
    private outputStream: stream.Writable;
    private output: string;

    /**
     * Create a `DockerizedBinary`
     * @param {string} dockerImage - e.g., `gcr.io/nomad-xyz/nomad-agent:some-tag`
     * @param {Docker.ContainerCreateOptions} containerOptions - see `Docker.createContainer(..)`
     */
    public constructor(dockerImage: string, containerOptions: Docker.ContainerCreateOptions) {
        this.docker = new Docker();
        this.dockerImage = dockerImage;
        this.containerOptions = containerOptions;
        this.output = '';
        this.outputStream = new stream.Writable({
            write: (chunk, encoding, next) => {
                this.output += chunk.toString();
                next()
            }
        });
    }

    /**
     * Run a command in a docker container
     * @param {string[]} cmd - e.g., `['echo', 'hello world']`
     * @return {Promise<string>} - Return the contents of `stdout` regardless of exit code
     */
    public async run(cmd: string[]): Promise<string> {
        return this.docker.run(
            this.dockerImage,
            cmd,
            this.outputStream,
            this.containerOptions
        ).then((result) => {
            let [_, container] = result;
            return new Promise((resolve, _) => {
                container.remove();
                return resolve(this.output)
            })
        })
    }
}
