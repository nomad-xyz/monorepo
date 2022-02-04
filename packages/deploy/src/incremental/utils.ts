import { NomadDomain } from '@nomad-xyz/sdk/nomad';
import { BridgeDeploy } from '../bridge/BridgeDeploy';
import { CoreDeploy } from '../core/CoreDeploy';
import {
  isValidEnvironment,
  VALID_ENVIRONMENTS,
} from '../verification/readDeployOutput';
import fs from 'fs';

/**
 * Structure that allows to poll an async block
 * for multiple times until it returns something or
 * timeouts. We can also set a period of polling.
 * **dev**: when callback returns nothing, hence `undefined`,
 * only then it retries, otherwise, when returns `T` it finishes
 */
export class Waiter<T> {
  private interval: NodeJS.Timeout;
  private timeout: NodeJS.Timeout;
  private promise: Promise<[T | undefined, boolean]>;
  private resolve: ((result: [T | undefined, boolean]) => void) | undefined;
  private reject: ((error: any) => void) | undefined;

  /**
   * Structure that allows to poll an async block
   * for multiple times until it returns something or
   * timeouts. We can also set a period of polling.
   * **dev**: when callback returns nothing, hence `undefined`,
   * only then it retries, otherwise, when returns `T` it finishes
   *
   * @param callback - async block to be polled. Should return `T|undefined`
   * @param timeoutMs - timeout period in milliseconds
   * @param retryMs - retry period in milliseconds
   *
   * @returns on `.wait()` returns promise of tuple `[T, success: boolean]`
   * where `T` is callback's return and second item is a `success` boolean
   */
  constructor(
    callback: () => Promise<T | undefined>,
    timeoutMs: number,
    retryMs: number,
  ) {
    this.resolve = undefined;
    this.reject = undefined;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    this.interval = setInterval(async () => {
      try {
        const result = await callback();
        if (result != undefined) {
          this.succeed(result);
        }
      } catch (e) {
        this.fail(e);
      }
    }, retryMs);

    this.timeout = setTimeout(this.doTimeout.bind(this), timeoutMs);
  }

  private fail(e: any) {
    if (this.reject) this.reject(e);
    this.stop();
  }

  private succeed(value: T) {
    if (this.resolve) this.resolve([value, true]);
    this.stop();
  }

  private doTimeout() {
    if (this.resolve) this.resolve([undefined, false]);
    this.stop();
  }

  private stop(): void {
    clearInterval(this.interval);
    clearTimeout(this.timeout);
  }

  /**
   * Method to wait for Waiter until it resolved with `success<T>` or `failure<undefined>`
   *
   * @returns tuple `[T, success: boolean]` where `T` is callback's
   * return and second item is a `success` boolean
   */
  async wait(): Promise<[T | undefined, boolean]> {
    return await this.promise;
  }
}

// TODO: bring it into good shape and move somewhere else. Also not sure if we should pass safe service as argument
export function deploysToSDK(
  core: CoreDeploy,
  bridge: BridgeDeploy,
  safeService?: string,
): NomadDomain {
  return {
    id: core.chain.domain,
    name: core.chain.name,
    bridgeRouter: bridge.contracts.bridgeRouter!.proxy.address,
    tokenRegistry: bridge.contracts.tokenRegistry!.proxy.address,
    ethHelper: bridge.contracts.ethHelper?.address,
    home: core.contracts.home!.proxy.address,
    replicas: Object.entries(core.contracts.replicas).map(
      ([domain, replica]) => ({
        domain: parseInt(domain),
        address: replica.proxy.address,
      }),
    ),
    governanceRouter: core.contracts.governance!.proxy.address,
    xAppConnectionManager: core.contracts.xAppConnectionManager!.address,
    safeService,
  };
}

export function writeBatchOutput(
  builtStr: string,
  unbuiltStr: string,
  environment: string,
) {
  const dir = getPathToBatchOutput(environment);

  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(`${dir}/built.json`, builtStr);

  fs.writeFileSync(`${dir}/unbuilt.json`, unbuiltStr);
}

export function getPathToBatchOutput(environment: string) {
  if (!isValidEnvironment) {
    throw new Error(
      `${environment} is not a valid environment. Please choose from ${JSON.stringify(
        VALID_ENVIRONMENTS,
        null,
        2,
      )}`,
    );
  }
  let folder;
  if (environment == 'staging') {
    folder = 'staging';
  } else if (environment == 'prod') {
    folder = 'mainnet';
  } else {
    folder = 'development';
  }
  return `../../governance/${folder}`;
}
