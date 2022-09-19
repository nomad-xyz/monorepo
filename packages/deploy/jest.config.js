module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageDirectory: '.coverage',
  verbose: true,
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};