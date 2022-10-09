import { filterUndefined, zip, getMessage, signUpdate, StreamMatcher, sleep, Waiter } from "../src/utils";
import { Wallet } from "ethers";
import * as Stream from "stream";
import { expect, assert, use as chaiUse } from "chai";


import chaiAsPromised from "chai-as-promised";

chaiUse(chaiAsPromised);


describe("utils.filterUndefined test", () => {
    it('should filter undefined values from an array', async () => {
        expect(filterUndefined([undefined, 1,2, undefined,3, undefined])).to.deep.equal([1,2,3]);
    });
});

describe("utils.zip test", () => {
    it('should zip 2 arrays of the same length', async () => {
        expect(zip([1,3,5], [2,4,6])).to.deep.equal([[1,2],[3,4],[5,6]]);
    });

    it('should throw if the arrays have different lengths', async () => {
        expect(() => zip([1,2,3], [1,2])).to.throw('Zipping 2 arrays of different length is wrong. a: 3, b: 2');
    });
});

describe("utils.getMessage test", () => {
    it('should create a u8 array', async () => {
        expect(getMessage(1337, '0x0001', '0x0002')).to.deep.equal(Uint8Array.from([
            50, 138, 212,  35, 215,   9, 192, 146, 221,
           168,  60, 156, 237,  56, 248,  63, 144, 218,
           145,  45,  14,  16, 249, 171, 209, 214,   8,
           194, 121, 190, 119,  48,   0,   1,   0,   2,
        ]));
    });
});

describe("utils.signUpdate test", () => {
    it('should properly sign an update', async () => {
        const s = new Wallet('0000000000000000000000000000000000000000000000000000000000000001');
        expect(await signUpdate(s, 1337, '0x0001', '0x0002')).to.equal('0x893077475a2083b40f9e22d0c432c2844cdd2054ee625e10c6f431b9c34b471a0ff5849fabf25f95348ef7bf9809c0d25694e75b6498d83118c42357ca33df941c');
    });
});


class ReadWriteStream extends Stream.Transform {
    constructor() {
      super();
    }
  
    _transform(chunk: any, encoding: string, callback: Function) {
      this.push(chunk);
      callback();
    }
}

describe("utils.StreamMatcher test", () => {
    it('can find data and regex it', async () => {

        const sm = new StreamMatcher();
        const s = new ReadWriteStream();

        let shouldBeFound = false;
        let secret = '';
        
        s.pipe(sm);

        sm.register(/secret_(\d+)/, (found) => {
            shouldBeFound = true;
            secret = found[1];
        });

        s.push('secret_fakeInfo');

        expect(shouldBeFound).to.be.false;
        expect(secret).to.equal('');

        s.push('secret_12345');

        expect(shouldBeFound).to.be.true;
        expect(secret).to.equal('12345');

        sm.unregister(/secret_(\d+)/);
        s.push('secret_234');

        expect(secret).to.equal('12345');
    });

    it('can find multiple data', async () => {

        const sm = new StreamMatcher();
        const s = new ReadWriteStream();

        let secrets: string[] = [];
        
        s.pipe(sm);

        sm.register(/secret_(\d+)/g, (found) => {
            secrets.push(found[1]);
        });

        s.push('secret_12345, secret_321');
        await sleep(50);

        expect(secrets).to.deep.equal(['12345', '321']);
    });

    it('can find strings and unregister them', async () => {

        const sm = new StreamMatcher();
        const s = new ReadWriteStream();

        let foundStringTimes = 0;
        
        s.pipe(sm);

        sm.register('somestring', () => {
            foundStringTimes += 1;
        });

        s.push('somestring');
        await sleep(50);

        expect(foundStringTimes).to.equal(1);

        sm.unregister('somestring');

        s.push('somestring');
        await sleep(50);

        expect(foundStringTimes).to.equal(1);        
    });

    it('can use strings to pass them to events', async () => {

        const sm = new StreamMatcher();
        const s = new ReadWriteStream();

        let foundString = false;
        
        s.pipe(sm);

        sm.register('somestring', 'string_found');

        sm.on('string_found', () => {
            foundString = true;
        });

        s.push('somestring');
        await sleep(50);

        expect(foundString).to.be.true;
    });
});


describe("utils.Waiter test", () => {
    it('can wait for promises', async () => {
        const w = new Waiter(async () => {
            await sleep(100);
            return true;
        }, 200, 50);

        const result = await w.wait();

        expect(result).to.be.true;
    });

    it('can wait for promises that return not immediately', async () => {
        let expectRetries = 0;

        const w = new Waiter<string>(async () => {
            return await new Promise((resolve, reject) => {
                if (++expectRetries === 3) {
                    resolve('yay!');
                }
            });
        }, 40, 10);

        const result = await w.wait();

        expect(result).to.equal('yay!');
    });

    it('should return null on timeout', async () => {
        let expectRetries = 0;

        const w = new Waiter<string>(async () => {
            return await new Promise((resolve, reject) => {
                if (++expectRetries === 3) {
                    resolve('yay!');
                }
            });
        }, 20, 10);

        const result = await w.wait();

        expect(result).to.equal(null);
    });

    it('can fail', async () => {

        const w = new Waiter<string>(async () => {
            return await new Promise((resolve, reject) => {
                reject('no real reason');
            });
        }, 20, 10);

        await assert.isRejected(w.wait(), "no real reason");
    });
});