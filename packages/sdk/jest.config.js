module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'ts-node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  verbose: true,
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  transform: {},
};
