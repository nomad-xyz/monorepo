import { BridgeContext } from '../src/BridgeContext';
import { BridgeMessage } from '../src/BridgeMessage';
import { GoldSkyBridgeBackend } from '../src/backend';

import {
  dispatchedMessage,
  updatedMessage,
  processedMessage,
} from './fixtures';

describe('Backend internals', () => {
  it('Backend query data only when needed', async () => {
    const defaultCallSpy = jest.spyOn(GoldSkyBridgeBackend, 'default');

    const context = new BridgeContext('production').withDefaultBackend();
    const backend = new GoldSkyBridgeBackend('production', 'dummy', context);
    context._backend = backend;

    const getMessageSpy = jest.spyOn(backend, 'getMessage');

    backend.fetchMessages = jest
      .fn()
      .mockReturnValueOnce([dispatchedMessage])
      .mockReturnValueOnce([updatedMessage])
      .mockReturnValueOnce([processedMessage]);
    const fetchSpy = jest.spyOn(backend, 'fetchMessages');

    const m = await BridgeMessage.bridgeFirstFromBackend(
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

    expect(await m.getReceived()).toEqual(
      '0x12121212121212121212121212121212121212121212121212121212121212',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    expect(await m.getSender()).toEqual(
      '0x00700700700700700700700700700700700700700700700700700700700700',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    expect(defaultCallSpy).toHaveBeenCalledTimes(1);
    expect(getMessageSpy).toHaveBeenCalledTimes(5);
  });
});
