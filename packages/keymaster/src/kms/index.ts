import { ethers, UnsignedTransaction } from "ethers";
import {
  getPublicKey,
  getEthereumAddress,
  requestKmsSignature,
  determineCorrectV,
} from "./util/aws-kms-utils";

export interface AwsKmsSignerCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region: string;
  keyId: string;
}
export class AwsKmsSigner extends ethers.Signer {
  kmsCredentials: AwsKmsSignerCredentials;

  ethereumAddress?: string;

  constructor(
    kmsCredentials: AwsKmsSignerCredentials,
    provider?: ethers.providers.Provider
  ) {
    super();
    this.kmsCredentials = kmsCredentials;

    ethers.utils.defineReadOnly(this, "provider", provider);
    ethers.utils.defineReadOnly(this, "kmsCredentials", kmsCredentials);
  }

  async getAddress(): Promise<string> {
    if (this.ethereumAddress === undefined) {
      const key = await getPublicKey(this.kmsCredentials);
      this.ethereumAddress = getEthereumAddress(key.PublicKey as Buffer);
    }
    return Promise.resolve(this.ethereumAddress);
  }

  async _signDigest(digestString: string): Promise<string> {
    const digestBuffer = Buffer.from(ethers.utils.arrayify(digestString));
    const sig = await requestKmsSignature(digestBuffer, this.kmsCredentials);
    const ethAddr = await this.getAddress();
    const { v } = determineCorrectV(digestBuffer, sig.r, sig.s, ethAddr);
    return ethers.utils.joinSignature({
      v,
      r: `0x${sig.r.toString("hex")}`,
      s: `0x${sig.s.toString("hex")}`,
    });
  }

  async signMessage(message: string | ethers.utils.Bytes): Promise<string> {
    return this._signDigest(ethers.utils.hashMessage(message));
  }

  async signTransaction(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>
  ): Promise<string> {
    const unsignedTx = await ethers.utils.resolveProperties(transaction);
    if (unsignedTx.from != null) {
      delete unsignedTx.from;
    }
    const serializedTx = ethers.utils.serializeTransaction(
      <UnsignedTransaction>unsignedTx
    );
    const transactionSignature = await this._signDigest(
      ethers.utils.keccak256(serializedTx)
    );
    return ethers.utils.serializeTransaction(
      <UnsignedTransaction>unsignedTx,
      transactionSignature
    );
  }

  connect(provider: ethers.providers.Provider): AwsKmsSigner {
    return new AwsKmsSigner(this.kmsCredentials, provider);
  }
}
