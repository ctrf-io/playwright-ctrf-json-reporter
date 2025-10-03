import { createFailedTestSuite } from './dummy-suites/failed-test-suite'
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

describe('Failed Tests', () => {
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
