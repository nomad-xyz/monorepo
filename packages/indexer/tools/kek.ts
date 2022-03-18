import { dev } from "@nomad-xyz/sdk";
// import {ethers} from "ethers";
import * as dotenv from "dotenv";
dotenv.config({});

(async () => {
    const ctx = dev;

    ctx.domainNumbers.forEach((domain) => {
        const name = ctx.mustGetDomain(domain).name.toUpperCase();
        const rpcEnvKey = `${name}_RPC`;
        const rpc = process.env[rpcEnvKey];
    
        if (!rpc)
            throw new Error(
                `RPC url for domain ${domain} is empty. Please provide as '${rpcEnvKey}=http://...' ENV variable`
            );
    
        ctx.registerRpcProvider(domain, rpc);
    });
    
    console.log(ctx.domainNumbers)

    const core = ctx.getCore(8000)!;
    const replica = core.getReplica(2000)!;
    const updateFilter = replica.filters.Update(2000, "0xe60b9f4d03232f124d4f23ca609e813dbc1983c255c14d1e88512c694c1fcf79");
    const updateEvents = await replica.queryFilter(updateFilter,);
    console.log('=========\n', updateEvents[0], '\n=========')

    const processFilter = replica.filters.Process(); // "0xb0f1bad2588faa5f0690e2ba60256988e2a1901f56ae639c730ff6a7e8e57536"
    
    console.log(processFilter)
    // const fff = {
    //     address: '0x53E7F6AFbECBB18a8E4989b89ADB1f0ce85272F5',
    //     topics: [
    //       '0xd42de95a9b26f1be134c8ecce389dc4fcfa18753d01661b7b361233569e8fe48',
    //       null,
    //       false
    //     ]
    //   }
    const processEvents = await replica.queryFilter(processFilter, 1997256);
    const foundEvents = processEvents//.filter((e) => !e.args.success);
    console.log('=========\n', foundEvents.length, '\n', foundEvents, '\n=========')

})()