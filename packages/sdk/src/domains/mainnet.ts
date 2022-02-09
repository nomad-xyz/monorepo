import { NomadDomain } from './domain';

export const ethereum: NomadDomain = {
  name: 'ethereum',
  id: 6648936,
  paginate: {
    from: 13983724,
    blocks: 2000,
  },
  home: '0x92d3404a7E6c91455BbD81475Cd9fAd96ACFF4c8',
  replicas: [
    {
      domain: 1650811245,
      address: '0x049b51e531Fd8f90da6d92EA83dC4125002F20EF',
    },
  ],
  governanceRouter: '0x3009C99D370B780304D2098196f1EBF779a4777a',
  xAppConnectionManager: '0xFe8874778f946Ac2990A29eba3CFd50760593B2F',
  bridgeRouter: '0x88A69B4E698A4B090DF6CF5Bd7B2D47325Ad30A3',
  tokenRegistry: '0x0A6f564C5c9BeBD66F1595f1B51D1F3de6Ef3b79',
  ethHelper: '0x2d6775C1673d4cE55e1f827A0D53e62C43d1F304',
};

export const moonbeam: NomadDomain = {
  name: 'moonbeam',
  id: 1650811245,
  paginate: {
    from: 171256,
    blocks: 500,
  },
  home: '0x8F184D6Aa1977fd2F9d9024317D0ea5cF5815b6f',
  replicas: [
    {
      domain: 6648936,
      address: '0x7F58bb8311DB968AB110889F2Dfa04ab7E8E831B',
    },
  ],
  governanceRouter: '0x569D80f7FC17316B4C83f072b92EF37B72819DE0',
  xAppConnectionManager: '0xdB378579c2Af11817EEA21474A39F95B5b9DfD7e',
  bridgeRouter: '0xD3dfD3eDe74E0DCEBC1AA685e151332857efCe2d',
  tokenRegistry: '0xa7E4Fea3c1468D6C1A3A77e21e6e43Daed855C1b',
  ethHelper: '0xB70588b1A51F847d13158ff18E9Cac861dF5Fb00',
};

export const mainnetDomains = [ethereum, moonbeam];
