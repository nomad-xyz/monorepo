import { describe, it } from 'mocha';

import { expect } from 'chai';

describe('sdk-bridge', async () => {
  describe('BridgeContext', () => {
    // before(async () => {
    //
    // });

    // beforeEach(async () => {
    //
    // });

    describe('fromNomadContext()', () => {
      it('returns a bridge given a context', () => {
        // TODO
        expect(true).to.be.true;
      });
    });

    describe('getBridge()', () => {
      it('gets a bridge', () => {
        // TODO
        expect(true).to.be.true;
      });
    });

    describe('mustGetBridge()', () => {
      it('gets a bridge', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if it cannot get a bridge', () => {
        // TODO
        expect(true).to.be.true;
      });
    });

    describe('resolveRepresentation()', () => {
      it('returns a single token representation', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if there is no provider or signer for a domain', () => {
        // TODO
        expect(true).to.be.true;
      });
    });

    describe('resolveRepresentations()', () => {
      it('returns all token representations', () => {
        // TODO
        expect(true).to.be.true;
      });
    });

    describe('resolveCanonicalIdentifier()', () => {
      it('returns details of the canonical token', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if the token if unknown to the bridge router on its domain', () => {
        // TODO
        expect(true).to.be.true;
      });
    });

    describe('resolveCanonicalToken()', () => {
      it('returns an interface for the token', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if the token doesn\'t exist', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if the cannot resolve on its own domain', () => {
        // TODO
        expect(true).to.be.true;
      });
    });

    describe('send()', () => {
      it('returns a message representing the transfer', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if the token is not available on the origin', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if there is no signer on the origin', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if there is no message to return', () => {
        // TODO
        expect(true).to.be.true;
      });
    });

    describe('sendNative()', () => {
      it('returns a message representing the transfer', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if there was an attempt to send token to failed home', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if there is no ethHelper on the origin', () => {
        // TODO
        expect(true).to.be.true;
      });

      it('throws if there is no message to return', () => {
        // TODO
        expect(true).to.be.true;
      });
    });
  }); 
});
