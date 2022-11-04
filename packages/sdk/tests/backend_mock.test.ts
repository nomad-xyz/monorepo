import { BigNumber } from 'ethers';
import { NomadContext, NomadMessage } from '../src/index';

import {GoldSkyBackend} from '../src/messageBackend/goldsky';
jest.mock('../src/messageBackend/goldsky'); // SoundPlayer is now a mock constructor

beforeEach(() => {
  // Clear all instances and calls to constructor and all methods:
  GoldSkyBackend.mockClear();
});

describe('Backend as a periphery', () => {
  it('NomadContext can initalize default backend', async () => {
    new NomadContext('production').withDefaultBackend();
    expect(GoldSkyBackend.default).toHaveBeenCalledTimes(1);
  });
})

// Might belong to Message tests
describe('Nomad message', () => {
    it('NomadMessage can fetch from backend', async () => {
        let context = new NomadContext('production', )
        let backend = new GoldSkyBackend('production', 'rerfg', context);
        context._backend = backend;
        
        // expect(GoldSkyBackend.default).toHaveBeenCalledTimes(0);
        expect(GoldSkyBackend).toHaveBeenCalledTimes(1);
    
        backend.getDispatches.mockImplementationOnce(async () => {
            return [{
                args: {
                  messageHash: '0x9ac49d0111cbef172353ee0fde36a9af5ddde9e83215ef0af8d2445751ef477c',
                  leafIndex: BigNumber.from('0x3331'),
                  destinationAndNonce: BigNumber.from('0x6265616d0000146d'),
                  committedRoot: '0x32b460ff74558afdb8627e845528ac8a4277e1dca91ba496ac9ba461ae262932',
                  message: '0x0065746800000000000000000000000088a69b4e698a4b090df6cf5bd7b2d47325ad30a30000146d6265616d000000000000000000000000d3dfd3ede74e0dcebc1aa685e151332857efce2d00657468000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc203000000000000000000000000ec54388ecef4ef40ecff41af0318f130cbd2730a0000000000000000000000000000000000000000000000000011c37937e0800069144a56ecb1b88cd5fea4f45c41f8bc298716dbc612b16010ccf8d7f01ba0a3'
                },
                transactionHash: '0x83e3dcf9235ec286864fcdc9ff3cbb8bc8d19eba3d034f8ef5f642ad95a4a93b'
              }]
        })
    
        await NomadMessage.baseFirstFromBackend(context, '0x83e3dcf9235ec286864fcdc9ff3cbb8bc8d19eba3d034f8ef5f642ad95a4a93b');

        expect(backend.getDispatches).toHaveBeenCalledTimes(1);
      })
})