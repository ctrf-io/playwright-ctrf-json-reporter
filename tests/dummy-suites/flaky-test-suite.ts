import {
  type Suite,
  type TestCase,
  type Location,
  type TestResult,
  type TestError,
} from '@playwright/test/reporter'

/**
 * Creates a minimal Suite object with a single flaky test
 * with 2 failed attempts and one passed attempt
 */
export const createFlakyTestSuite = (): Suite => {
  const testError: TestError = {
    message: 'test-error-message',
    stack: 'test-error-stack',
    snippet: 'test-error-snippet',
  }

  const failedTestResult: TestResult = {
    retry: 0,
    duration: 4444,
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
    annotations: [],
  }

  const testError2: TestError = {
    message: 'test-error-message2',
    stack: 'test-error-stack2',
    snippet: 'test-error-snippet2',
  }

  const failedTestResult2: TestResult = {
    retry: 1,
    duration: 5555,
    status: 'failed',
    startTime: new Date('2023-01-01T00:00:00.000Z'),
    parallelIndex: 0,
    workerIndex: 0,
    attachments: [],
    errors: [testError2],
    error: testError2,
    steps: [],
    stdout: [],
    stderr: [],
    annotations: [],
  }

  const passedTestResult: TestResult = {
    retry: 2,
    duration: 888,
    status: 'passed',
    startTime: new Date('2023-01-01T00:00:05.200Z'),
    parallelIndex: 0,
    workerIndex: 0,
    attachments: [],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    annotations: [],
  }

  const testCase: TestCase = {
    title: 'should validate the expected condition',
    id: 'test-id-123',
    annotations: [],
    tags: [],
    type: 'test',
    expectedStatus: 'passed',
    timeout: 30000,
    results: [failedTestResult, failedTestResult2, passedTestResult],
    location: {
      file: 'flaky-test.spec.ts',
      line: 42,
      column: 3,
    },
    parent: undefined as any, // Will be set later
    outcome: () => 'flaky',
    ok: () => true,
    titlePath: () => ['Flaky Test Suite', 'should be flaky'],
    repeatEachIndex: 0,
    retries: 1,
  }

  const suite: Suite = {
    title: 'Flaky Test Suite',
    titlePath: () => ['Flaky Test Suite'],
    entries: () => [testCase],
    type: 'project',
    location: {
      file: 'flaky-test.spec.ts',
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
      retries: 3,
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
