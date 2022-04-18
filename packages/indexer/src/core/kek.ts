import { ProcessorV2 } from "./consumerV2";
import { IndexerCollector } from "./metrics";
import { DB } from "./db";
import { createLogger, replacer, reviver } from "./utils";
import fs from 'fs';
import { NomadishEvent } from "./event";
import { createClient } from "redis";


const environment = 'production';
const batchesFolder = './batches';


(async () => {

    const logger = createLogger("indexer", environment);
    const m = new IndexerCollector(environment, logger);

    const db = new DB(m, logger);
    await db.connect();

    const redis = createClient({
        url: process.env.REDIS_URL || "redis://redis:6379",
    });

    const c = new ProcessorV2(db, logger, redis);

    const fileNames = fs.readdirSync(batchesFolder).sort();
    console.log(fileNames);
    for (const fileName of fileNames) {
        console.log(`Opening`, fileName)
        const events: Object[] = JSON.parse(fs.readFileSync(`${batchesFolder}/${fileName}`, 'utf8'), reviver);

        await c.consume(events.map(e => NomadishEvent.fromObject(e)));
        console.log(`DID batch `, fileName[0])
    }
})()


/*
2	244
3	3
4	2971
nomad_indexer_number_messages{stage="dispatched",network="xdai",environment="production"} 0
nomad_indexer_number_messages{stage="updated",network="xdai",environment="production"} 0
nomad_indexer_number_messages{stage="relayed",network="xdai",environment="production"} 3
nomad_indexer_number_messages{stage="received",network="xdai",environment="production"} 0
nomad_indexer_number_messages{stage="processed",network="xdai",environment="production"} 0
nomad_indexer_number_messages{stage="dispatched",network="moonbeam",environment="production"} 0
nomad_indexer_number_messages{stage="updated",network="moonbeam",environment="production"} 0
nomad_indexer_number_messages{stage="relayed",network="moonbeam",environment="production"} 210
nomad_indexer_number_messages{stage="received",network="moonbeam",environment="production"} 1
nomad_indexer_number_messages{stage="processed",network="moonbeam",environment="production"} 1110
nomad_indexer_number_messages{stage="dispatched",network="ethereum",environment="production"} 0
nomad_indexer_number_messages{stage="updated",network="ethereum",environment="production"} 0
nomad_indexer_number_messages{stage="relayed",network="ethereum",environment="production"} 1
nomad_indexer_number_messages{stage="received",network="ethereum",environment="production"} 0
nomad_indexer_number_messages{stage="processed",network="ethereum",environment="production"} 1775
nomad_indexer_number_messages{stage="dispatched",network="milkomedaC1",environment="production"} 0
nomad_indexer_number_messages{stage="updated",network="milkomedaC1",environment="production"} 0
nomad_indexer_number_messages{stage="relayed",network="milkomedaC1",environment="production"} 33
nomad_indexer_number_messages{stage="received",network="milkomedaC1",environment="production"} 0
nomad_indexer_number_messages{stage="processed",network="milkomedaC1",environment="production"} 85
*/

// 0	1
// 1	4
// 2	243
// 3	2
// 4	2966