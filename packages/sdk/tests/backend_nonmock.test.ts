import { NomadContext, NomadMessage } from '../src/index';
import {GoldSkyBackend, GoldSkyMessage} from '../src/messageBackend/goldsky';

describe('Backend internals', () => {
    it('Backend query data only when needed', async () => {

        let context = new NomadContext('production').withDefaultBackend()
        let backend = new GoldSkyBackend('production', 'rerfg', context);
        context._backend = backend;

        const dispatchSpy = jest.spyOn(backend, 'getDispatches');
        const getMessageSpy = jest.spyOn(backend, 'getMessage');

        backend.fetchMessages = jest.fn().mockReturnValue([
            {
            committed_root: '0x32b460ff74558afdb8627e845528ac8a4277e1dca91ba496ac9ba461ae262932',
            destination_and_nonce: '7090180309144048749',
            destination_domain_id: 1650811245,
            destination_domain_name: 'moonbeam',
            dispatch_block: '15223410',
            dispatch_tx: '0x83e3dcf9235ec286864fcdc9ff3cbb8bc8d19eba3d034f8ef5f642ad95a4a93b',
            dispatched_at: '1658910170',
            id: '0x83e3dcf9235ec286864fcdc9ff3cbb8bc8d19eba3d034f8ef5f642ad95a4a93b-107',
            leaf_index: '13105',
            message: '0x0065746800000000000000000000000088a69b4e698a4b090df6cf5bd7b2d47325ad30a30000146d6265616d000000000000000000000000d3dfd3ede74e0dcebc1aa685e151332857efce2d00657468000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc203000000000000000000000000ec54388ecef4ef40ecff41af0318f130cbd2730a0000000000000000000000000000000000000000000000000011c37937e0800069144a56ecb1b88cd5fea4f45c41f8bc298716dbc612b16010ccf8d7f01ba0a3',
            message__action__amount: '298023223',
            message__action__details_hash: '69144a56ecb1b88cd5fea4f45c41f8bc298716dbc612b16010ccf8d7f01ba0a3',
            message__action__to: '0xec54388ecef4ef40ecff41af0318f130cbd2730a',
            message__action__type: '03',
            message__token__domain: '6648936',
            message__token__id: '000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            message_body: '00657468000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc203000000000000000000000000ec54388ecef4ef40ecff41af0318f130cbd2730a0000000000000000000000000000000000000000000000000011c37937e0800069144a56ecb1b88cd5fea4f45c41f8bc298716dbc612b16010ccf8d7f01ba0a3',
            message_hash: '0x9ac49d0111cbef172353ee0fde36a9af5ddde9e83215ef0af8d2445751ef477c',
            message_type: 'TRANSFER',
            new_root: '',
            nonce: 5229,
            old_root: '',
            origin_domain_id: 6648936,
            origin_domain_name: 'ethereum',
            process_block: '1525706',
            process_tx: '0xa03a72bcea4deff1e6cdc9e526db43a2305d094f71d6b3fb1d296ff4cb6f4668',
            processed_at: '1658912724',
            recipient_address: '0xd3dfd3ede74e0dcebc1aa685e151332857efce2d',
            relay_block: '1525533',
            relay_chain_id: 1650811245,
            relay_tx: '0x74cd9f1c5260d27e7003123973b94394fb01968f32999ac7038c74ade1a1abf9',
            relayed_at: '1658910564',
            sender_address: '0x88a69b4e698a4b090df6cf5bd7b2d47325ad30a3',
            signature: '',
            update_block: '',
            update_chain_id: 0,
            update_tx: undefined,
            updated_at: ''
            } as GoldSkyMessage
        ])
        const fetchSpy = jest.spyOn(backend, 'fetchMessages');
    
        const m = await NomadMessage.baseFirstFromBackend(context, '0x83e3dcf9235ec286864fcdc9ff3cbb8bc8d19eba3d034f8ef5f642ad95a4a93b');
    
        const relayTx = await m.getRelay();
        const processTx = await m.getProcess();
        const updateTx = await m.getUpdate(); // Update is not present in the mock return for `backend.fetchMessages`, so it should once bump `fetchMessages`

        expect(relayTx).toBe('0x74cd9f1c5260d27e7003123973b94394fb01968f32999ac7038c74ade1a1abf9')
        expect(processTx).toBe('0xa03a72bcea4deff1e6cdc9e526db43a2305d094f71d6b3fb1d296ff4cb6f4668')
        expect(updateTx).toBeUndefined();

        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(getMessageSpy).toHaveBeenCalledTimes(4);
      })
})