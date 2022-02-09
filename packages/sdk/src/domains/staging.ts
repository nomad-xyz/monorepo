import { NomadDomain } from './domain';

export const rinkeby: NomadDomain = {
  name: 'rinkeby',
  id: 2000,
  paginate: {
    from: 29371335,
    blocks: 2000,
  },
  home: '0x86BE4e9Bc9d1dd25866477a343ea8FD2cCf11dF9',
  replicas: [
    {
      domain: 3000,
      address: '0x3F28A3e66326c3aa494d4F8e9477d1397EE94432',
    },
    {
      domain: 5000,
      address: '0x4058C320fe3Ee874FeC5e83B5BcA9267641C60bE',
    },
  ],
  governanceRouter: '0x681bb680067909552C868b54329F8b14342837E4',
  bridgeRouter: '0xA51a5c634309524899160327168d7f5e41988Df1',
  tokenRegistry: '0x84B8eA132CBBAbC90e0d01E2965978204F60E46C',
  ethHelper: '0x3B810a4545E4E71b1126dF389482eb37C0aE8815',
  xAppConnectionManager: '0xB72E8910e67B5743E9255F1BEa2F9e0EADbB4E65',
};

export const kovan: NomadDomain = {
  name: 'kovan',
  id: 3000,
  paginate: {
    from: 29371350,
    blocks: 2000,
  },
  home: '0x85789e726B31cB74ba471aeF5FF93c3f68AE510F',
  replicas: [
    {
      domain: 2000,
      address: '0x3C4BD86F76E524EA81B3E84eE75C964A2ae20bc1',
    },
  ],
  governanceRouter: '0x01403db34b7aFCb5144D9c37876da5ef58b66646',
  bridgeRouter: '0xe2364b8B5BE2BE6B32B5BA77e29F4c22944E3ce8',
  tokenRegistry: '0x04062bbE05607afFcbc70FbAB1A36EF661b51760',
  ethHelper: '0x8679A6f835b4Bd647035d623571894665099ac36',
  xAppConnectionManager: '0xFA148438B26D36bcE290a45e12AA00Bdf0B9ca2e',
};

export const moonbasealpha: NomadDomain = {
  name: 'moonbasealpha',
  id: 5000,
  paginate: {
    from: 1556676,
    blocks: 500,
  },
  home: '0xeA5EE132A66c2cE09AEB8baDdabb26EcF33603AE',
  replicas: [
    {
      domain: 2000,
      address: '0xDAF0b05031CDB7B138627af790d23FBa442A6017',
    },
  ],
  governanceRouter: '0xB5013Dc90fC096F22b9D5b6121EE5887552F88B7',
  bridgeRouter: '0x65A779c45334B09DE19Ccd0b5AE508Eb4D56EB4d',
  tokenRegistry: '0x33a977668b223744AF77B0d3AbB6A24899E7DE5B',
  ethHelper: '0x53976bBAf52e7B6770BfF6a24d26d3E4cac3DA59',
  xAppConnectionManager: '0x166b6a590A2eBEb71C3BDc74762C03a1276BBA0C',
};

export const stagingDomains = [rinkeby, kovan, moonbasealpha];
