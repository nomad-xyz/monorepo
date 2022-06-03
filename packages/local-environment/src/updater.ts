// import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
// import * as ethers from 'ethers';
// import * as types from './types';

// export class Updater {
//     localDomain: types.Domain;
//     signer: SignerWithAddress;
//     address: types.Address;
  
//     constructor(
//       signer: SignerWithAddress,
//       address: types.Address,
//       localDomain: types.Domain,
//       disableWarn: boolean,
//     ) {
//       if (!disableWarn) {
//         throw new Error('Please use `Updater.fromSigner()` to instantiate.');
//       }
//       this.localDomain = localDomain ? localDomain : 0;
//       this.signer = signer;
//       this.address = address;
//     }
  
//     static async fromSigner(
//       signer: SignerWithAddress,
//       localDomain: types.Domain,
//     ) {
//       return new Updater(signer, await signer.getAddress(), localDomain, true);
//     }
  
//     domainHash() {
//       return domainHash(this.localDomain);
//     }
  
//     message(oldRoot: types.HexString, newRoot: types.HexString) {
//       return ethers.utils.concat([this.domainHash(), oldRoot, newRoot]);
//     }
  
//     async signUpdate(oldRoot: types.HexString, newRoot: types.HexString) {
//       let message = this.message(oldRoot, newRoot);
//       let msgHash = ethers.utils.arrayify(ethers.utils.keccak256(message));
//       let signature = await this.signer.signMessage(msgHash);
//       return {
//         origin: this.localDomain,
//         oldRoot,
//         newRoot,
//         signature,
//       };
//     }
//   }
  
// function domainHash(domain: Number): string {
//   return ethers.utils.solidityKeccak256(
//     ['uint32', 'string'],
//     [domain, 'NOMAD'],
//   );
// }