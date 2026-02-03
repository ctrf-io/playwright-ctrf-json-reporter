/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: ['default'],
  testPathIgnorePatterns: ['/node_modules/', '/__mocks__/'],
}
