import { DeployContext } from '@nomad-xyz/deploy/src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import * as ethers from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import * as dotenv from 'dotenv';
import { getConfig, getOverrides } from '@nomad-xyz/deploy/scripts/utils';
dotenv.config();

run();

async function run() {
  // instantiate deploy context
  const DEPLOY_CONFIG: config.NomadConfig = getConfig();
  const deployContext = new DeployContext(DEPLOY_CONFIG);

  // get deploy signer and overrides
  const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error('Add DEPLOYER_PRIVATE_KEY to .env');
  }
  const OVERRIDES = getOverrides();
  // add deploy signer and overrides for each network
  for (const network of deployContext.networks) {
    const provider = deployContext.mustGetProvider(network);
    const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
    const signer = new NonceManager(wallet);
    deployContext.registerSigner(network, signer);
    deployContext.overrides.set(network, OVERRIDES[network]);
  }
  try {
    // run the deploy script
    deployContext.validate();

    // Checks for connections that are present in the config,
    // but lack the on-chain state to be connected,
    // such as missing deployed contracts or
    // missing on-chain configuration transactions.
    // Deploys all missing contracts.
    // Attempts to submit any missing configuration transactions;
    // if unable to submit the transaction, adds them to callBatch as governance actions.
    await deployContext.ensureCoreConnections();
    // await this.ensureBridgeConnections();

    // relinquish control of all other contracts from deployer to governance
    await deployContext.relinquishCoreOwnership();

    // appoint governor on all networks
    await Promise.all(
      deployContext.networks.filter(net => deployContext.isNetEvm(net)).map((network) =>
      deployContext.mustGetCore(network).appointGovernor(),
      ),
    );

    // output governance transactions
    // once all actions have completed
    await deployContext.outputGovernance();

    // const governanceBatch = await deployContext.deployAndRelinquish();
    this.log.info(`Deployed! gov batch:`);

    await deployContext.checkCores();
    this.log.info(`Checked deployment`);

    console.log(`DONE!`);
  } catch (e) {
    // if the deploy script fails,
    // ensure the updated config & verification are outputted
    // then re-run the script to pick up where it left off
    deployContext.output();
    
    throw e;
  }
}
