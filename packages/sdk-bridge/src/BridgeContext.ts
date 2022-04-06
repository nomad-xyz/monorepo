import { BigNumberish, ethers } from 'ethers';
import { utils as mpUtils } from '@nomad-xyz/multi-provider';
import * as bridge from '@nomad-xyz/contracts-bridge';
import { FailedHomeError, NomadContext } from '@nomad-xyz/sdk';
import { hexlify } from '@ethersproject/bytes';
import { BridgeContracts } from './BridgeContracts';
import { ResolvedTokenInfo, TokenIdentifier } from './tokens';
import { TransferMessage } from './BridgeMessage';
import * as config from '@nomad-xyz/configuration';

type Address = string;

/**
 * The BridgeContext manages connections to Nomad Bridge contracts.
 * It inherits from the {@link MultiProvider} and {@link NomadContext} and
 * ensures that its contracts always use the latest registered providers and
 * signers.
 */

export class BridgeContext extends NomadContext {
  private bridges: Map<string, BridgeContracts>;

  constructor(environment: string | config.NomadConfig = 'development') {
    super(environment);

    this.bridges = new Map();
    const bridges = this.conf.networks.map(
      (network) =>
        new BridgeContracts(this, network, this.conf.bridge[network]),
    );

    bridges.forEach((bridge) => {
      this.bridges.set(bridge.domain, bridge);
    });
  }

  static fromNomadContext(context: NomadContext): BridgeContext {
    const bridge = new BridgeContext(context.conf);

    for (const domain of context.domainNumbers) {
      const provider = context.getProvider(domain);
      if (provider) bridge.registerProvider(domain, provider);

      const signer = context.getSigner(domain);
      if (signer) bridge.registerSigner(domain, signer);
    }

    return bridge;
  }

  /**
   * Get the {@link BridgeContracts} for a given domain (or undefined)
   *
   * @param nameOrDomain A domain name or number.
   * @returns a {@link BridgeContracts} object (or undefined)
   */
  getBridge(nameOrDomain: string | number): BridgeContracts | undefined {
    const domain = this.resolveDomainName(nameOrDomain);
    return this.bridges.get(domain);
  }

  /**
   * Get the {@link BridgeContracts} for a given domain (or throw an error)
   *
   * @param nameOrDomain A domain name or number.
   * @returns a {@link BridgeContracts} object
   * @throws if no {@link BridgeContracts} object exists on that domain.
   */
  mustGetBridge(nameOrDomain: string | number): BridgeContracts {
    const bridge = this.getBridge(nameOrDomain);
    if (!bridge) {
      throw new Error(`Missing bridge for domain: ${nameOrDomain}`);
    }
    return bridge;
  }

  /**
   * Resolve the local representation of a token on some domain. E.g. find the
   * deployed Celo address of Ethereum's Sushi Token.
   *
   * WARNING: do not hold references to this contract, as it will not be
   * reconnected in the event the chain connection changes.
   *
   * @param nameOrDomain the target domain, which hosts the representation
   * @param token The token to locate on that domain
   * @returns An interface for that token (if it has been deployed on that
   * domain)
   */
  async resolveRepresentation(
    nameOrDomain: string | number,
    token: TokenIdentifier,
  ): Promise<bridge.BridgeToken | undefined> {
    const domain = this.resolveDomain(nameOrDomain);
    const bridgeContracts = this.getBridge(domain);

    const tokenDomain = this.resolveDomain(token.domain);
    const tokenId = mpUtils.canonizeId(token.id);

    const address = await bridgeContracts?.tokenRegistry[
      'getLocalAddress(uint32,bytes32)'
    ](tokenDomain, tokenId);

    if (!address || address == ethers.constants.AddressZero) {
      return;
    }
    const connection = this.getConnection(domain);
    if (!connection) {
      throw new Error(
        `No provider or signer for ${domain}. Register a connection first before calling resolveRepresentation.`,
      );
    }
    return bridge.BridgeToken__factory.connect(
      mpUtils.evmId(address),
      connection,
    );
  }

  /**
   * Resolve the local representation of a token on ALL known domain. E.g.
   * find ALL deployed addresses of Ethereum's Sushi Token, on all registered
   * domains.
   *
   * WARNING: do not hold references to these contracts, as they will not be
   * reconnected in the event the chain connection changes.
   *
   * @param token The token to locate on ALL domains
   * @returns A {@link ResolvedTokenInfo} object with representation addresses
   */
  async resolveRepresentations(
    token: TokenIdentifier,
  ): Promise<ResolvedTokenInfo> {
    const tokens: Map<number, bridge.BridgeToken> = new Map();

    await Promise.all(
      this.domainNumbers.map(async (domain) => {
        const tok = await this.resolveRepresentation(domain, token);
        if (tok) {
          tokens.set(domain, tok);
        }
      }),
    );

    return {
      domain: this.resolveDomain(token.domain),
      id: token.id,
      tokens,
    };
  }

  /**
   * Resolve the canonical domain and identifier for a representation on some
   * domain.
   *
   * @param nameOrDomain The domain hosting the representation
   * @param representation The address of the representation on that domain
   * @returns The domain and ID for the canonical token
   * @throws If the token is unknown to the bridge router on its domain.
   */
  async resolveCanonicalIdentifier(
    nameOrDomain: string | number,
    representation: Address,
  ): Promise<TokenIdentifier> {
    const domain = this.resolveDomain(nameOrDomain);
    const bridge = this.mustGetBridge(nameOrDomain);
    const repr = hexlify(mpUtils.canonizeId(representation));

    const canonical = await bridge.tokenRegistry.representationToCanonical(
      representation,
    );

    if (canonical[0] !== 0) {
      return {
        domain: canonical[0],
        id: canonical[1],
      };
    }

    // check if it's a local token
    const local = await bridge.tokenRegistry['getLocalAddress(uint32,bytes32)'](
      domain,
      repr,
    );
    if (local !== ethers.constants.AddressZero) {
      return {
        domain,
        id: hexlify(mpUtils.canonizeId(local)),
      };
    }

    // throw
    throw new Error('Token not known to the bridge');
  }

  /**
   * Resolve an interface for the canonical token corresponding to a
   * representation on some domain.
   *
   * @param nameOrDomain The domain hosting the representation
   * @param representation The address of the representation on that domain
   * @returns An interface for that token
   * @throws If the token is unknown to the bridge router on its domain.
   */
  async resolveCanonicalToken(
    nameOrDomain: string | number,
    representation: Address,
  ): Promise<bridge.BridgeToken> {
    const canonicalId = await this.resolveCanonicalIdentifier(
      nameOrDomain,
      representation,
    );
    if (!canonicalId) {
      throw new Error('Token seems to not exist');
    }
    const token = await this.resolveRepresentation(
      canonicalId.domain,
      canonicalId,
    );
    if (!token) {
      throw new Error(
        'Cannot resolve canonical on its own domain. how did this happen?',
      );
    }
    return token;
  }

  /**
   * Send tokens from one domain to another. Approves the bridge if necessary.
   *
   * @param from The domain to send from
   * @param to The domain to send to
   * @param token The canonical token to send (details from originating chain)
   * @param amount The amount (in smallest unit) to send
   * @param recipient The identifier to send to on the `to` domain
   * @param enableFast TRUE to enable fast liquidity; FALSE to require no fast liquidity
   * @param overrides Any tx overrides (e.g. gas price)
   * @returns a {@link TransferMessage} object representing the in-flight
   *          transfer
   * @throws On missing signers, missing tokens, tx issues, etc.
   */
  async send(
    from: string | number,
    to: string | number,
    token: TokenIdentifier,
    amount: BigNumberish,
    recipient: Address,
    enableFast = false,
    overrides: ethers.Overrides = {},
  ): Promise<TransferMessage> {
    const fromDomain = this.resolveDomain(from);

    await this.checkHome(fromDomain);
    if (this.blacklist().has(fromDomain)) {
      throw new FailedHomeError(
        this,
        'Attempted to send token to failed home!',
      );
    }

    const fromBridge = this.mustGetBridge(from);
    const bridgeAddress = fromBridge.bridgeRouter.address;

    const fromToken = await this.resolveRepresentation(from, token);
    if (!fromToken) {
      throw new Error(`Token not available on ${from}`);
    }
    const sender = this.getSigner(from);
    if (!sender) {
      throw new Error(`No signer for ${from}`);
    }
    const senderAddress = await sender.getAddress();

    const approved = await fromToken.allowance(senderAddress, bridgeAddress);
    // Approve if necessary
    if (approved.lt(amount)) {
      const tx = await fromToken.approve(bridgeAddress, amount, overrides);
      await tx.wait();
    }

    const tx = await fromBridge.bridgeRouter.populateTransaction.send(
      fromToken.address,
      amount,
      this.resolveDomain(to),
      mpUtils.canonizeId(recipient),
      enableFast,
      overrides,
    );
    // kludge: increase gas limit by 10%
    tx.gasLimit = tx.gasLimit?.mul(110).div(100);
    const dispatch = await this.mustGetSigner(from).sendTransaction(tx);
    const receipt = await dispatch.wait();

    const message = TransferMessage.singleFromReceipt(this, from, receipt);
    if (!message) {
      throw new Error();
    }

    return message as TransferMessage;
  }

  /**
   * Send a chain's native asset from one chain to another using the
   * `EthHelper` contract.
   *
   * @param from The domain to send from
   * @param to The domain to send to
   * @param amount The amount (in smallest unit) to send
   * @param recipient The identifier to send to on the `to` domain
   * @param enableFast TRUE to enable fast liquidity; FALSE to require no fast liquidity
   * @param overrides Any tx overrides (e.g. gas price)
   * @returns a {@link TransferMessage} object representing the in-flight
   *          transfer
   * @throws On missing signers, tx issues, etc.
   */
  async sendNative(
    from: string | number,
    to: string | number,
    amount: BigNumberish,
    recipient: Address,
    enableFast = false,
    overrides: ethers.PayableOverrides = {},
  ): Promise<TransferMessage> {
    const fromDomain = this.resolveDomain(from);

    await this.checkHome(fromDomain);
    if (this.blacklist().has(fromDomain)) {
      throw new FailedHomeError(
        this,
        'Attempted to send token to failed home!',
      );
    }

    const ethHelper = this.mustGetBridge(from).ethHelper;
    if (!ethHelper) {
      throw new Error(`No ethHelper for ${from}`);
    }

    const toDomain = this.resolveDomain(to);

    overrides.value = amount;

    const tx = await ethHelper.populateTransaction.sendToEVMLike(
      toDomain,
      recipient,
      enableFast,
      overrides,
    );
    // patch fix: increase gas limit by 10%
    tx.gasLimit = tx.gasLimit?.mul(110).div(100);
    const dispatch = await this.mustGetSigner(from).sendTransaction(tx);
    const receipt = await dispatch.wait();

    const message = TransferMessage.singleFromReceipt(this, from, receipt);
    if (!message) {
      throw new Error();
    }

    return message as TransferMessage;
  }
}
