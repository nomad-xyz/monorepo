import { getHexDomainFromString } from '@nomad-xyz/sdk/utils';

// npm run calculate-domain <network abbreviation (e.g. "eth")>
(async () => {
  const args = process.argv.slice(2);
  const network = args[0];

  const hexBytes = getHexDomainFromString(network);
  console.log(`${network} interpreted as hex number: ${hexBytes}`);
})();
