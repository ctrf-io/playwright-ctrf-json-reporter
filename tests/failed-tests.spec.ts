import { createFailedTestSuite } from './dummy-suites/failed-test-suite'
import GenerateCtrfReport from '../src/generate-report'
import { CtrfReport } from '../types/ctrf'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'

vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}))

const nowDateMock = new Date('2023-01-01T00:00:00.000Z')
vi.useFakeTimers()
vi.setSystemTime(nowDateMock)

const mockedFs = vi.mocked(fs)

describe('Failed Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate report with error details correctly', async () => {
    // Arrange
    const testSuite = createFailedTestSuite()
    const report = new GenerateCtrfReport()

    // Act
    report.onBegin(undefined as any, testSuite)
    report.onEnd()

    // Assert
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1)

    const reportJsonContent = mockedFs.writeFileSync.mock.calls[0][1] as string
    const parsedReport: CtrfReport = JSON.parse(reportJsonContent)

    expect(parsedReport.results.tests).toHaveLength(2)
    expect(parsedReport.results.tests[0].status).toBe('failed')
    expect(parsedReport.results.tests[0].rawStatus).toBe('failed')
    expect(parsedReport.results.tests[0].status).toBe('failed')
    expect(parsedReport.results.tests[0].message).toBe('test-error-message')
    expect(parsedReport.results.tests[0].trace).toBe('test-error-stack')
    expect(parsedReport.results.tests[0].snippet).toBe('test-error-snippet')
    expect(parsedReport.results.tests[1].status).toBe('passed')
    expect(parsedReport.results.tests[1].rawStatus).toBe('failed')
    expect(parsedReport.results.tests[1].message).toBe('test-error-message')
    expect(parsedReport.results.tests[1].trace).toBe('test-error-stack')
    expect(parsedReport.results.tests[1].snippet).toBe('test-error-snippet')
  })
})
