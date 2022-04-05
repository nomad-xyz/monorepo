import DeployContext from '../src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import {getConfig} from "./utils";
import bunbyan from 'bunyan';

const l = bunbyan.createLogger({name: 'checks'})
// instantiate deploy context
const DEPLOY_CONFIG: config.NomadConfig = getConfig();
const deployContext = new DeployContext(DEPLOY_CONFIG, l);

// run checks on deployment
deployContext.checkDeployment();
