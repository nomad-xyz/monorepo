import { NomadDomain } from './domain';

export const rinkeby: NomadDomain = {
  name: 'rinkeby',
  id: 2000,
  paginate: {
    from: 10024912,
    blocks: 2000,
  },
  home: '0xBfCBCCce35D8a6e8056c92f225768EbBfBbf1293',
  replicas: [
    {
      domain: 3000,
      address: '0x7DF0496470369FFFACB660A5139e1649ABFE9D21',
    },
    {
      domain: 5000,
      address: '0xA062dcaEc568Ccf01560F168D0638af2fE663019',
    },
    {
      domain: 8000,
      address: '0xf9EdA8f3ee170b64c6640094e9a8bF9cb9f359f3',
    },
  ],
  governanceRouter: '0xB1F0bB0d6a40d5003f2A62D9a146791A90270F1d',
  bridgeRouter: '0xeACafFb9fBCe3d4c4C5D07AF5DFa51CcF5a348b7',
  tokenRegistry: '0x885A8bd4be130422AEB1Eb9Eeb9513a5D2102cad',
  ethHelper: '0x074cd4d8629445Fda3b17574FCB848eda767058b',
  xAppConnectionManager: '0x7e365A910383cE8Dfa6860B080a9D4cd58d2BD13',
};

export const kovan: NomadDomain = {
  name: 'kovan',
  id: 3000,
  paginate: {
    from: 29367895,
    blocks: 2000,
  },
  home: '0x4071e4E6AB8F8F1620200B7CF0b92ba930D9aBB6',
  replicas: [
    {
      domain: 2000,
      address: '0xFA58C14B693C44140208211dDa4A81c182B557c1',
    },
  ],
  governanceRouter: '0x25d3Da24cA79E80D15f808866351311D282AC332',
  bridgeRouter: '0xa50E2db92c48f1c20C42338e6091E6B73da376a4',
  tokenRegistry: '0x7fe65Cd0b589B39E7744DE73ad225085F0FE7f39',
  ethHelper: '0xEFf85cD6763fEc984470bB1F433777d73aF1298B',
  xAppConnectionManager: '0xE469D8587D45BF85297BD924b159E726E7CA5408',
};

export const moonbasealpha: NomadDomain = {
  name: 'moonbasealpha',
  id: 5000,
  paginate: {
    from: 1555095,
    blocks: 500,
  },
  home: '0x79F0267e3e4E457E13Ed79552D3606382bb0F66a',
  replicas: [
    {
      domain: 2000,
      address: '0x6d8aCF60f3ddB6C49dEF2A2b77E56BE2FF1502Cf',
    },
  ],
  governanceRouter: '0x22431cD0b489f148fd34baEE3AcCF815750AC732',
  bridgeRouter: '0x07235F5AE672B80649D79ebceBe749Ba4E520754',
  tokenRegistry: '0x9F671D2A7e48b97Ad7E080fbf495d060c536De94',
  ethHelper: '0x71a0CAfbc6bd7F16188B141850d9Bdce47981B1c',
  xAppConnectionManager: '0xD99E2c5eD0AacE4c459A850bd2DE0b1c0De12bfD',
};

export const milkomedatestnet: NomadDomain = {
  name: 'milkomedatestnet',
  id: 8000,
  paginate: {
    from: 1771254,
    blocks: 2000,
  },
  home: '0x8e68819f8596B7D23CBfe1D8A0605675c1eD646f',
  replicas: [
    {
      domain: 2000,
      address: '0x53E7F6AFbECBB18a8E4989b89ADB1f0ce85272F5',
    },
  ],
  governanceRouter: '0x66daa391eF8679b08246Ab9a5F56EBc5Eb6489c8',
  bridgeRouter: '0x4C2e47cA4Dd7b93A62730e463BE43A0EA01c5A10',
  tokenRegistry: '0xC2205CA7803B21748AC2854994Cfe10E5440CDEf',
  ethHelper: '0x3Ec2235bFdBcA03C3709c97D23f9d72c75F8A7Dd',
  xAppConnectionManager: '0xf116142af150F8E2b939C14f746a67Ed6788266C',
};

export const devDomains = [rinkeby, kovan, moonbasealpha, milkomedatestnet];
