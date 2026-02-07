/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: [
    'default',
    [
      'jest-ctrf-json-reporter',
      {},
    ],
  ],
  testPathIgnorePatterns: ['/node_modules/', '/__mocks__/'],
}
