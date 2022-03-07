import { dev } from './registerContext';
import { buildConfig } from './config';

import {
  BridgeContext,
  AnnotatedSend,
  AnnotatedTokenDeployed,
  TokenDeployedArgs,
  TokenDeployedTypes,
} from '@nomad-xyz/sdk-bridge';
import { TSContract, queryAnnotatedEvents } from '@nomad-xyz/sdk';
import { uploadDeployedTokens } from './googleSheets';

export type TokenDetails = {
  name: string;
  symbol: string;
  decimals: number;
};

export type Deploy = AnnotatedTokenDeployed & { token: TokenDetails };
export type Send = AnnotatedSend & { token: TokenDetails };

export async function getDomainDeployedTokens(
  context: BridgeContext,
  nameOrDomain: string | number,
): Promise<Deploy[]> {
  const domain = context.resolveDomain(nameOrDomain);
  const registry = context.mustGetBridge(domain).tokenRegistry;
  // get Send events
  const annotated = await queryAnnotatedEvents<
    TokenDeployedTypes,
    TokenDeployedArgs
  >(
    context,
    domain,
    registry as TSContract<TokenDeployedTypes, TokenDeployedArgs>,
    registry.filters.TokenDeployed(),
    context.mustGetDomain(domain).paginate?.from,
  );

  return await Promise.all(
    annotated.map(async (e: AnnotatedTokenDeployed) => {
      const deploy = e as any;

      const erc20 = await context.resolveCanonicalToken(
        domain,
        deploy.event.args.representation,
      );
      const [name, symbol, decimals] = await Promise.all([
        erc20.name(),
        erc20.symbol(),
        erc20.decimals(),
      ]);

      deploy.token = {};
      deploy.token.name = name;
      deploy.token.symbol = symbol;
      deploy.token.decimals = decimals;
      return deploy as Deploy;
    }),
  );
}

export async function getDeployedTokens(
  context: BridgeContext,
): Promise<Map<number, Deploy[]>> {
  const events = new Map();
  for (const domain of context.domainNumbers) {
    events.set(domain, await getDomainDeployedTokens(context, domain));
  }
  return events;
}

function prettyDeploy(context: BridgeContext, deploy: Deploy) {
  const {
    event: {
      args: { domain, id, representation },
    },
    token: { name, symbol, decimals },
  } = deploy;

  return { domain, id, representation, name, symbol, decimals };
}

export async function printDeployedTokens(
  context: BridgeContext,
): Promise<void> {
  const deployed = await getDeployedTokens(context);

  for (const [key, value] of deployed.entries()) {
    const trimmed = value.map((deploy) => prettyDeploy(context, deploy));
    console.log(`DOMAIN: ${key} ${context.resolveDomainName(key)}`);
    console.table(trimmed);
  }
}

export async function persistDeployedTokens(
  context: BridgeContext,
  credentials: string
): Promise <void> {
  const deployed = await getDeployedTokens(context);
  for(let domain of deployed.keys()){
    let domainName = context.resolveDomainName(domain)
    const tokens = deployed.get(domain)
    uploadDeployedTokens(domainName!, tokens!, credentials)
  }
}

(async function main() {
  const config = buildConfig("tokens")
  await persistDeployedTokens(dev, config.googleCredentialsFile)
})();
