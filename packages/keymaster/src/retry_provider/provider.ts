import { ethers } from "ethers";
import { Context } from "../context";
import { sleep } from "../utils";

export class MyJRPCProvider extends ethers.providers.StaticJsonRpcProvider {
  networkName: string;
  ctx: Context;
  constructor(
    url: string | ethers.utils.ConnectionInfo,
    networkName: string,
    ctx: Context,
    network?: ethers.providers.Networkish
  ) {
    super(url, network);
    this.networkName = networkName;
    this.ctx = ctx;

    this.ctx.logger.debug(`Created MyJRPCProvider ${networkName}`);
  }

  async perform(method: string, params: any): Promise<any> {
    this.ctx.logger.debug(`Performing method: ${method}`);
    const timeout = 2000;

    let lastError;

    for (let attempt = 0; attempt <= 5; attempt++) {
      try {
        this.ctx.metrics.incRpcRequests(this.networkName, method);
        const start = new Date().valueOf();
        const result = await super.perform(method, params);
        const time = new Date().valueOf() - start;
        this.ctx.metrics.observeLatency(this.networkName, method, time);
        return result;
      } catch (e: any) {
        lastError = e;
        this.ctx.logger.error(
          {
            method,
            params,
            reason: e.reason,
            code: e.code || "NO_CODE",
            network: this.networkName,
          },
          `Failed to perform request`
        );
        this.ctx.metrics.incRpcErrors(
          this.networkName,
          method,
          e.code || "NO_CODE"
        );

        if (e.code === "INSUFFICIENT_FUNDS" || e.code === "INVALID_ARGUMENT") {
          throw e;
        } else {
          await sleep(timeout * 2 ** attempt);
        }
      }
    }

    throw lastError;
  }

  async sendTransactionPlus(
    signedTransaction: string | Promise<string>,
    wait: 5
  ): Promise<ethers.providers.TransactionReceipt> {
    const result = await super.sendTransaction(signedTransaction);

    const receipt = await result.wait(wait);

    this.ctx.metrics.observeGasUsed(
      this.networkName,
      "sendTransaction",
      receipt.gasUsed
    );

    return receipt;
  }
}
