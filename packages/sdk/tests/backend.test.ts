import { NomadContext, NomadMessage } from '../src/index';
import { GoldSkyBackend } from '../src/messageBackend/goldsky';
import {
  goldSkyMessageDispatched,
  goldSkyMessageProcessed,
  goldSkyMessageRelayed,
  goldSkyMessageUpdated,
} from './fixtures';

describe('Backend internals', () => {
  it('Backend query data only when needed', async () => {
    const defaultCallSpy = jest.spyOn(GoldSkyBackend, 'default');

    const context = new NomadContext('production').withDefaultBackend();
    const backend = new GoldSkyBackend('production', 'dummy', context);
    context._backend = backend;

    const dispatchSpy = jest.spyOn(backend, 'getDispatches');
    const getMessageSpy = jest.spyOn(backend, 'getMessage');

    backend.fetchMessages = jest
      .fn()
      .mockReturnValueOnce([goldSkyMessageDispatched])
      .mockReturnValueOnce([goldSkyMessageUpdated])
      .mockReturnValueOnce([goldSkyMessageRelayed])
      .mockReturnValueOnce([goldSkyMessageProcessed]);
    const fetchSpy = jest.spyOn(backend, 'fetchMessages');

    const m = await NomadMessage.baseFirstFromBackend(
      context,
      '0x83e3dcf9235ec286864fcdc9ff3cbb8bc8d19eba3d034f8ef5f642ad95a4a93b',
    );

    expect(m.recipient).toEqual(
      '0x000000000000000000000000d3dfd3ede74e0dcebc1aa685e151332857efce2d',
    );
    expect(m.sender).toEqual(
      '0x00000000000000000000000088a69b4e698a4b090df6cf5bd7b2d47325ad30a3',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await m.getUpdate()).toEqual(
      '0x13371337133713371337133713371337133713371337133713371337133713',
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(await m.getUpdate()).toEqual(
      '0x13371337133713371337133713371337133713371337133713371337133713',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(await m.getRelay()).toEqual(
      '0x74cd9f1c5260d27e7003123973b94394fb01968f32999ac7038c74ade1a1abf9',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    expect(await m.getProcess()).toEqual(
      '0xa03a72bcea4deff1e6cdc9e526db43a2305d094f71d6b3fb1d296ff4cb6f4668',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(4);

    expect(defaultCallSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(getMessageSpy).toHaveBeenCalledTimes(7);
  });
});
