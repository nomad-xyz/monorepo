import DeployContext from '../src/DeployContext';
import * as config from '@nomad-xyz/configuration';
import {getConfig} from "./utils";

// instantiate deploy context
const DEPLOY_CONFIG: config.NomadConfig = getConfig();
const deployContext = new DeployContext(DEPLOY_CONFIG);

// run checks on deployment
deployContext.checkDeployment();
