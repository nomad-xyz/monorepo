import { utils } from '@nomad-xyz/multi-provider';
(async () => {
  const args = process.argv.slice(2);
  const network = args[0];
  if (!network) {
    console.error('Error: You need to pass a network as command line argument');
    process.exit(1);
  }

  const hexBytes = utils.getDomainFromString(network);
  console.log(`${network} interpreted as hex number: ${hexBytes}`);
})();
