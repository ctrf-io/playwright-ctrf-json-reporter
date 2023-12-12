import GenerateCtrfReport from '../src/generate-report'
import {
  Suite,
  type FullConfig,
  type TestCase,
  type TestResult,
} from '@playwright/test/reporter'
const fs = require('fs')
const path = require('path')

jest.mock('fs')
jest.mock('path')

describe('GenerateCtrfReport', () => {
  let reporter: GenerateCtrfReport

  beforeEach(() => {
    reporter = new GenerateCtrfReport()
  })

  describe('Set config options', () => {
    describe('filename', () => {
      it('should set filename from reporterConfigOptions if present', () => {
        const mockFilename = 'mockFilename.json'
        const mockConfig: Partial<FullConfig> = {
          reporter: [
            [(reporter as any).reporterName, { outputFile: mockFilename }],
          ],
        }

        reporter.onBegin(mockConfig as FullConfig)

        expect((reporter as any).reporterConfigOptions.outputFile).toBe(
          mockFilename
        )
      })

      it('should use default filename if reporterConfigOptions filename is not present', () => {
        const mockConfigWithoutFilename: Partial<FullConfig> = {
          reporter: [[(reporter as any).reporterName]],
        }

        reporter.onBegin(mockConfigWithoutFilename as FullConfig)

        expect((reporter as any).outputFile).toBe(
          (reporter as any).defaultFilename
        )
      })
    })
  })

  describe('setFilename', () => {
    it('should add .json extension if none provided', () => {
      ;(reporter as any).setFilename('myReport')
      expect((reporter as any).reporterConfigOptions.outputFile).toBe(
        'myReport.json'
      )
    })

    it('should keep .json extension if already provided', () => {
      ;(reporter as any).setFilename('myReport.json')
      expect((reporter as any).reporterConfigOptions.outputFile).toBe(
        'myReport.json'
      )
    })

    it('should append .json to any other extensions', () => {
      ;(reporter as any).setFilename('myReport.txt')
      expect((reporter as any).reporterConfigOptions.outputFile).toBe(
        'myReport.txt.json'
      )
    })
  })

  describe('updateTotalsFromTestResult', () => {
    let reporter: GenerateCtrfReport

    beforeEach(() => {
      reporter = new GenerateCtrfReport()
    })

    const mockTest: TestCase = { title: 'Sample Test' } as TestCase

    it('should update the total tests count', () => {
      const mockResult: TestResult = {
        status: 'passed',
        duration: 100,
      } as TestResult

      ;(reporter as any).updateTotalsFromTestResult(
        mockResult,
        reporter.ctrfReport
      )

      expect(reporter.ctrfReport.results.totals.tests).toBe(1)
    })

    it.each([
      ['passed', 1, 0, 0, 0, 0, 0],
      ['failed', 0, 1, 0, 0, 0, 0],
      ['skipped', 0, 0, 1, 0, 0, 0],
      ['interrupted', 0, 1, 0, 0, 0, 0],
      ['timedOut', 0, 1, 0, 0, 0, 0],
    ])(
      'should update for status %s',
      (status, passed, failed, skipped, interrupted, timedOut) => {
        const mockResult: TestResult = { status, duration: 100 } as TestResult

        ;(reporter as any).updateTotalsFromTestResult(
          mockResult,
          reporter.ctrfReport
        )

        expect(reporter.ctrfReport.results.totals.passed).toBe(passed)
        expect(reporter.ctrfReport.results.totals.failed).toBe(failed)
        expect(reporter.ctrfReport.results.totals.skipped).toBe(skipped)
      }
    )
  })

  describe('writeToFile', () => {
    beforeEach(() => {
      fs.writeFileSync.mockClear()
      path.join.mockImplementation((...args: string[]) => args.join('/'))

      reporter.reporterConfigOptions.outputDir = '.'
      reporter.reporterConfigOptions.outputFile = 'ctrf-report.json'
    })

    it('should write the report to a file', () => {
      const mockData = reporter.ctrfReport
      const expectedFilePath = './ctrf-report.json'

      reporter.writeReportToFile(mockData)

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedFilePath,
        JSON.stringify(mockData, null, 2) + '\n'
      )
    })
  })
})

const mockSuite: Partial<Suite> = {
  title: 'Login Tests Suite',
  project: undefined,
  titlePath: () => ['Root Suite', 'Login Tests Suite'],
  allTests: () => [],
  suites: [],
  tests: [],
}

const mockTestCase: Partial<TestCase> = {
  title: 'User should be able to login',
  parent: mockSuite as Suite,
  location: {
    file: 'tests/login.test.js',
    line: 10,
    column: 5,
  },
}

const mockTestResult: Partial<TestResult> = {
  status: 'passed',
  duration: 1200,
  startTime: new Date('2023-01-01T00:00:00.000Z'),
  attachments: [],
  retry: 0,
}
