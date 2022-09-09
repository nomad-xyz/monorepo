import { Command, Flags } from '@oclif/core';
import execa from 'execa';

export default class Killswitch extends Command {
  static description = 'describe the command here';

  static examples = ['<%= config.bin %> <%= command.id %>'];

  static flags = {
    // flag with a value (-n, --name=VALUE)
    name: Flags.string({ char: 'n', description: 'name to print' }),
    // flag with no value (-f, --force)
    force: Flags.boolean({ char: 'f' }),
  };

  static args = [{ name: 'file' }];

  public async run(): Promise<void> {
    await execa('echo', ['killswitch']).stdout?.pipe(process.stdout);
    this.log('killswitch called');
  }
}
