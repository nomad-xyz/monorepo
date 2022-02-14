import { utils as mpUtils } from '@nomad-xyz/multi-provider';

// npm run calculate-domain <network abbreviation (e.g. "eth")>
(async () => {
  const args = process.argv.slice(2);
  const network = args[0];

  const hexBytes = mpUtils.getHexDomainFromString(network);
  console.log(`${network} interpreted as hex number: ${hexBytes}`);
})();
