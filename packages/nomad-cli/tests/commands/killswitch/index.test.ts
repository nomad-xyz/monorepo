import { expect } from '@oclif/test';
import Killswitch from '../../../src/commands/killswitch';

describe('killswitch', () => {
  let result;

  beforeEach(() => {
    result = [];
    jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((val) => result.push(val));
  });

  afterEach(() => jest.restoreAllMocks());

  it('passes', async () => {
    // TODO: mock execa and check arguments passed
    await Killswitch.run([]);
    expect(result).contain('killswitch called\n');
  });
});
