import GenerateCtrfReport from '../src/generate-report'
import {
  type FullConfig,
  type TestCase,
  type TestResult,
} from '@playwright/test/reporter'
const fs = require('fs')
const path = require('path');

jest.mock('fs')
jest.mock('path');

describe('GenerateCtrfReport', () => {
  let reporter: GenerateCtrfReport

  beforeEach(() => {
    reporter = new GenerateCtrfReport()
  })

  describe('Validation and events', () => {
    it('should register listener for onBegin', () => {
      const mockConfig: FullConfig = {
        reporter: [['ctrf-json-report', { filename: 'mockFilename.json' }]],
      } as FullConfig

      jest.spyOn(reporter, 'onBegin')
      reporter.onBegin(mockConfig)

      expect(reporter.onBegin).toHaveBeenCalledWith(mockConfig)
    })

    it('should register listener for onTestEnd', () => {
      const mockTest: TestCase = { title: 'Sample Test' } as TestCase
      const mockResult: TestResult = { status: 'passed' } as TestResult

      jest.spyOn(reporter, 'onTestEnd')
      reporter.onTestEnd(mockTest, mockResult)

      expect(reporter.onTestEnd).toHaveBeenCalledWith(mockTest, mockResult)
    })

    it('should register listener for onEnd', () => {
      jest.spyOn(reporter, 'onEnd')
      reporter.onEnd()

      expect(reporter.onEnd).toHaveBeenCalled()
    })
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

        expect((reporter as any).filename).toBe(mockFilename)
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
      expect((reporter as any).filename).toBe('myReport.json')
    })

    it('should keep .json extension if already provided', () => {
      ;(reporter as any).setFilename('myReport.json')
      expect((reporter as any).filename).toBe('myReport.json')
    })

    it('should append .json to any other extensions', () => {
      ;(reporter as any).setFilename('myReport.txt')
      expect((reporter as any).filename).toBe('myReport.txt.json')
    })
  })

  describe('getReporterConfigOptions', () => {
    it('should return options with a single reporterConfig', () => {
      const mockConfig = {
        reporter: [
          [(reporter as any).reporterName, { filename: 'mockFilename.json' }],
        ],
      } as FullConfig

      const result = reporter.getReporterConfigOptions(mockConfig)
      expect(result).toEqual({ filename: 'mockFilename.json' })
    })

    it('should return options with multiple reporterConfig', () => {
      const mockConfig = {
        reporter: [
          ['some-other-reporter', { foo: 'bar' }],
          [(reporter as any).reporterName, { filename: 'mockFilename.json' }],
          ['another-reporter', { baz: 'qux' }],
        ],
      } as FullConfig

      const result = reporter.getReporterConfigOptions(mockConfig)
      expect(result).toEqual({ filename: 'mockFilename.json' })
    })

    it('should return undefined if no reporterConfig', () => {
      const mockConfig = {
        reporter: [['some-other-reporter', { foo: 'bar' }]],
      } as FullConfig

      const result = reporter.getReporterConfigOptions(mockConfig)
      expect(result).toBeUndefined()
    })

    it('should return undefined if no reporterConfigOptions', () => {
      const mockConfig = {
        reporter: [[(reporter as any).reporterName]],
      } as FullConfig

      const result = reporter.getReporterConfigOptions(mockConfig)
      expect(result).toBeUndefined()
    })
  })

  describe('updateCtrfTestResultsFromTestResult', () => {

    it('should update the ctrfReport with required test properties', () => {
      const mockTest: TestCase = { title: 'Sample Test' } as TestCase
      const mockResult: TestResult = {
        status: 'passed',
        duration: 100,
      } as TestResult

      ;(reporter as any).updateCtrfTestResultsFromTestResult(
        mockTest,
        mockResult,
        reporter.ctrfReport
      )

      const updatedTestResult = reporter.ctrfReport.results.tests[0]

      expect(updatedTestResult.name).toBe(mockTest.title)
      expect(updatedTestResult.status).toBe(mockResult.status)
      expect(updatedTestResult.duration).toBe(mockResult.duration)
    })

    it.each([
      ['Test 1', 'passed', 100],
      ['Test 2', 'failed', 200],
      ['Test 3', 'skipped', 300],
    ])(
      'should correctly update the ctrfReport for test "%s" with status "%s" and duration %i',
      (testTitle, status, duration) => {
        const mockTest: TestCase = { title: testTitle } as TestCase
        const mockResult: TestResult = {
          status: status as any,
          duration,
        } as TestResult

        ;(reporter as any).updateCtrfTestResultsFromTestResult(
          mockTest,
          mockResult,
          reporter.ctrfReport
        )

        const updatedTestResult =
          reporter.ctrfReport.results.tests[
            reporter.ctrfReport.results.tests.length - 1
          ]

        expect(updatedTestResult.name).toBe(testTitle)
        expect(updatedTestResult.status).toBe(status)
        expect(updatedTestResult.duration).toBe(duration)
      }
    )
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
        expect(reporter.ctrfReport.results.totals.interrupted).toBe(interrupted)
        expect(reporter.ctrfReport.results.totals.timedOut).toBe(timedOut)
      }
    )
  })

  describe('writeToFile', () => {
    beforeEach(() => {
      fs.writeFileSync.mockClear();
      path.join.mockImplementation((...args: string[]) => args.join('/'));
  
      // Set up reporter configuration for the test
      reporter.outputDir = '.';
      reporter.filename = 'ctrf-report.json'; // Set the default filename
    });
  
    it('should write the report to a file', () => {
      const mockData = reporter.ctrfReport;
      const expectedFilePath = './ctrf-report.json'; // Expected file path based on defaultOutputDir and filename
  
      reporter.writeToFile('ctrf-report.json', mockData); // Use the same filename as set in the reporter
  
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expectedFilePath,
        JSON.stringify(mockData, null, 2) + '\n'
      );
    });
  });
  
})
