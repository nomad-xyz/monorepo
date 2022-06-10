import { ethers } from "ethers"
import { Context } from "../context";
import { logToFile, retry } from "../utils";

export class MyJRPCProvider extends ethers.providers.StaticJsonRpcProvider {
    networkName: string;
    ctx: Context;
    constructor(url: string | ethers.utils.ConnectionInfo, networkName: string, ctx: Context, network?: ethers.providers.Networkish) {
        super(url, network)
        this.networkName = networkName;
        this.ctx = ctx;

        this.ctx.logger.debug(`Created MyJRPCProvider ${networkName}`);
    }

    async perform(method: string, params: any): Promise<any> {
        this.ctx.logger.debug(`Performing method: ${method}`);

        const [result, error] = await retry(async () => {
            this.ctx.metrics.incRpcRequests(this.networkName, method);
            const start = new Date().valueOf();
            const result = await super.perform(method, params);
            const time = new Date().valueOf() - start;
            this.ctx.metrics.observeLatency(this.networkName, method, time);
            return result;
        }, 5, (e) => {
            logToFile(JSON.stringify(e))
            this.ctx.logger.error(`Failed to perform request. Method: ${method}, params: ${params}, Reason: ${e.reason}`, e);
            this.ctx.metrics.incRpcErrors(this.networkName, method, e.code||'NO_CODE');
        });
        
        if (result) {
            return result;
        } else {
            throw error;
        }
    }

    async sendTransactionPlus(signedTransaction: string | Promise<string>, wait: 5): Promise<ethers.providers.TransactionReceipt> {
        const result = await super.sendTransaction(signedTransaction);

        const receipt = await result.wait(wait);

        this.ctx.metrics.incGasUsed(this.networkName, 'sendTransaction', receipt.gasUsed.toNumber());

        return receipt;
    }

}