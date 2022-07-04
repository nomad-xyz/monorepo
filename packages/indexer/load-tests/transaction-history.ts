import { step, TestSettings, beforeAll } from '@flood/element';
import { buildUri, getAddresses, getMessageHistory } from './utils';
import { NomadEnvironment, environment } from '../src/config';

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
  ],
};

const indexerURI = buildUri(environment || NomadEnvironment.DEVELOPMENT);
let addresses = [];

export default (): void => {
  beforeAll(async () => {
    addresses = await getAddresses(indexerURI);
  });
  step('Query Tx History', async () => {
    for (let index = 0; index < addresses.length; index++) {
      const address = addresses[index];
      await getMessageHistory(indexerURI, address);
    }
  });
};
