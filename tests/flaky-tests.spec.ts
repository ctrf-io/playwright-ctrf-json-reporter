import { createFlakyTestSuite } from './dummy-suites/flaky-test-suite'
import GenerateCtrfReport from '../src/generate-report'
import fs from 'fs'
import { CtrfReport } from '../types/ctrf'

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
}))
const nowDateMock = new Date('2023-01-01T00:00:00.000Z')
jest.useFakeTimers().setSystemTime(nowDateMock)

const mockedFs = fs as jest.Mocked<typeof fs>

describe('Flaky Tests', () => {
  it('should generate report with retry attempts correctly', async () => {
    // Arrange
    const testSuite = createFlakyTestSuite()
    const report = new GenerateCtrfReport()

    // Act
    report.onBegin(undefined as any, testSuite)
    report.onEnd()

    // Assert
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1)

    const reportJsonContent = mockedFs.writeFileSync.mock.calls[0][1] as string
    const parsedReport: CtrfReport = JSON.parse(reportJsonContent)

    expect(parsedReport.results.tests).toHaveLength(1)

    const test = parsedReport.results.tests[0]

    expect(test.status).toBe('passed')
    expect(test.retries).toBe(2)
    expect(test.flaky).toBe(true)
    expect(test.duration).toBe(888)

    expect(test.retryAttempts).toHaveLength(2)

    const failedAttempt = test.retryAttempts![0]
    expect(failedAttempt.status).toBe('failed')
    expect(failedAttempt.duration).toBe(4444)
    expect(failedAttempt.message).toBe('test-error-message')
    expect(failedAttempt.trace).toBe('test-error-stack')
    expect(failedAttempt.snippet).toBe('test-error-snippet')

    const failedAttempt2 = test.retryAttempts![1]
    expect(failedAttempt2.status).toBe('failed')
    expect(failedAttempt2.duration).toBe(5555)
    expect(failedAttempt2.message).toBe('test-error-message2')
    expect(failedAttempt2.trace).toBe('test-error-stack2')
    expect(failedAttempt2.snippet).toBe('test-error-snippet2')
  })
})
