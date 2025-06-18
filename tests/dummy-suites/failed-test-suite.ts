import {
  type Suite,
  type TestCase,
  type Location,
  type TestResult,
  type TestError,
} from '@playwright/test/reporter'

/**
 * Creates a minimal Suite object with a single failed test
 */
export const createFailedTestSuite = (): Suite => {
  const testError: TestError = {
    message: 'test-error-message',
    stack: 'test-error-stack',
    snippet: 'test-error-snippet',
  }

  const testResult: TestResult = {
    retry: 0,
    duration: 120,
    status: 'failed',
    startTime: new Date('2023-01-01T00:00:00.000Z'),
    parallelIndex: 0,
    workerIndex: 0,
    attachments: [],
    errors: [testError],
    error: testError,
    steps: [],
    stdout: [],
    stderr: [],
  }

  const testCase: TestCase = {
    title: 'should validate the expected condition',
    id: 'test-id-123',
    annotations: [],
    expectedStatus: 'passed',
    timeout: 30000,
    results: [testResult],
    location: {
      file: 'test-file.spec.ts',
      line: 42,
      column: 3,
    },
    parent: undefined as any, // Will be set later
    outcome: () => 'unexpected',
    ok: () => false,
    titlePath: () => [
      'Failed Test Suite',
      'should validate the expected condition',
    ],
    repeatEachIndex: 0,
    retries: 0,
  }

  const suite: Suite = {
    title: 'Failed Test Suite',
    titlePath: () => ['Failed Test Suite'],
    location: {
      file: 'test-file.spec.ts',
      line: 10,
      column: 1,
    } as Location,
    project: () => ({
      name: 'Test Project',
      outputDir: './test-results',
      grep: /.*/,
      grepInvert: null,
      metadata: {},
      dependencies: [],
      repeatEach: 1,
      retries: 0,
      timeout: 30000,
      use: {},
      testDir: './tests',
      testIgnore: [],
      testMatch: [],
      snapshotDir: './snapshots',
    }),
    allTests: () => [testCase],
    tests: [testCase],
    suites: [],
  }

  testCase.parent = suite

  return suite
}
