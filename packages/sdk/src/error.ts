import * as config from '@nomad-xyz/configuration';
import { WithContext } from '@nomad-xyz/multi-provider';
import { NomadContext } from './NomadContext';

export class NomadError extends WithContext<config.Domain, NomadContext> {}

export class FailedHomeError extends NomadError {
  constructor(context: NomadContext, msg: string) {
    super(context, msg);
    this.name = 'FailedHomeError';
  }
}
