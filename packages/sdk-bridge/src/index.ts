import(/* webpackMode: "eager" */ '@nomad-xyz/configuration');

export { BridgeContracts } from './BridgeContracts';

export * from './bridgeEvents';
export * as bridgeEvents from './bridgeEvents';

export * from './BridgeContext';

export * from './BridgeMessage';

export * from './tokens';
export type { TokenIdentifier } from './tokens';

// export * as BridgeMessage from './BridgeMessage'

//
// TODO: refactor to export specific things and submodules too like below:
//
// export { SpecificThing } from './subModule';
// export * as subModule from './subModule';
//
// so devs can do:
// import { SpecificThing, subModule } from '@nomad-xyz/package';
//
