// Mock @playwright/test for Jest unit tests
// The adapter imports this, but unit tests don't need actual Playwright
module.exports = {
  test: {
    info: jest.fn(() => {
      throw new Error('test.info() called outside Playwright context')
    }),
  },
}
