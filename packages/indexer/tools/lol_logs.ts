import axios from 'axios';
import { sleep } from '../core/utils';
import fs from 'fs';

async function getMetric(host: string, name: string) {
    const res = await axios.get(`${host}/metrics`);
    let text = res.data.split(`\n`).filter((line: string) => line.match(/nomad_indexer_number_messages/)).join(`\n`);
    text = `${new Date().toISOString()}\n${text}\n\n`;
    fs.appendFileSync(`/tmp/metrics_${name}.txt`, text);
}

(async () => {

    while (true) {
        try {
            await Promise.all([
                getMetric('http://localhost:9090', 'local'),
                getMetric('http://192.168.1.109:9090', 'rpi')
            ]);
            
        } catch(e) {

        }
        
        await sleep(3000)
    }

})()