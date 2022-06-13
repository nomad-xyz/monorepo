import { step, TestSettings, beforeAll, TestData} from '@flood/element'
import { buildUri, getAddresses, getMessageHistory } from './utils';

export const settings: TestSettings = {
	userAgent: 'flood-load-test',
	loopCount: 5,
    actionDelay: 0.1,
    duration: -1,
    stages: [
        { duration: '10m', target: 1 },
        { duration: '10m', target: 5 },
        { duration: '30m', target: 10 },
        { duration: '30m', target: 20 },
        { duration: '30m', target: 30 },
        { duration: '30m', target: 20 },
        { duration: '30m', target: 10 },
        { duration: '10m', target: 5 },
        { duration: '10m', target: 1 },
    ]
}

const ENVIRONMENT = process.env["ENVIRONMENT"] || "development"
const indexerURI = buildUri(ENVIRONMENT)
let addresses = [];

export default () => {
    beforeAll(async () => {
      addresses = await getAddresses(indexerURI);
	  })
    step("Query Tx History", async () => {
      for (let index = 0; index < addresses.length; index++) {
        const address = addresses[index];
        const data = await getMessageHistory(indexerURI, address)
      }
    })
};