import {
  type Suite,
  type FullConfig,
  type Reporter,
  type TestCase,
  type TestResult,
} from '@playwright/test/reporter'
import * as fs from 'fs'
import * as path from 'path'
import {
  type CtrfTestState,
  type CtrfReport,
  type CtrfTest,
} from '../types/ctrf'

interface ReporterConfigOptions {
  outputFile: string
  outputDir: string
  minimal: boolean
  start: boolean
  stop: boolean
  suite: boolean
  message: boolean
  trace: boolean
  rawStatus: boolean
  tags: boolean
  type: boolean
  filePath: boolean
  retry: boolean
  flake: boolean
  browser: boolean
  device: boolean
  screenshot: boolean
  customType?: string
}

type ReporterConfig = [string, ReporterConfigOptions?]

class GenerateCtrfReport implements Reporter {
  readonly ctrfReport: CtrfReport
  reporterConfigOptions: ReporterConfigOptions
  readonly reporterName = 'ctrf-json-reporter'

  readonly defaultOutputFile = 'ctrf-report.json'
  readonly defaultOutputDir = '.'
  filename = this.defaultOutputFile
  outputDir = this.defaultOutputDir

  constructor() {
    this.reporterConfigOptions = {
      outputFile: this.defaultOutputFile,
      outputDir: this.defaultOutputDir,
      minimal: false,
      start: true,
      stop: true,
      suite: true,
      message: true,
      trace: true,
      rawStatus: true,
      tags: true,
      type: true,
      filePath: true,
      retry: true,
      flake: true,
      browser: true,
      device: true,
      screenshot: false,
    }

    this.ctrfReport = {
      results: {
        tool: {
          name: 'playwright',
        },
        totals: {
          tests: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          timedOut: 0,
          interrupted: 0,
          other: 0,
        },
        tests: [],
      },
    }
  }

  onBegin(config: FullConfig): void {
    this.reporterConfigOptions = this.getReporterConfigOptions(config)

    if (!fs.existsSync(this.reporterConfigOptions.outputDir)) {
      fs.mkdirSync(this.reporterConfigOptions.outputDir, { recursive: true })
    }

    this.setFilename(this.reporterConfigOptions.outputFile)
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.updateCtrfTestResultsFromTestResult(test, result, this.ctrfReport)
    this.updateTotalsFromTestResult(result, this.ctrfReport)
  }

  onEnd(): void {
    this.writeReportToFile(this.ctrfReport)
  }

  getReporterConfigOptions(config: FullConfig): ReporterConfigOptions {
    const reporterConfig = config.reporter.find(
      (r) => r[0] === this.reporterName
    ) as ReporterConfig | undefined

    if (reporterConfig == null) {
      return this.reporterConfigOptions
    }

    return { ...this.reporterConfigOptions, ...reporterConfig[1] }
  }

  setFilename(filename: string): void {
    if (filename.endsWith('.json')) {
      this.filename = filename
    } else {
      this.filename = `${filename}.json`
    }
  }

  updateCtrfTestResultsFromTestResult(
    testCase: TestCase,
    testResult: TestResult,
    ctrfReport: CtrfReport
  ): void {
    const test: CtrfTest = {
      name: testCase.title,
      status: this.mapPlaywrightStatusToCtrf(testResult.status),
      duration: testResult.duration,
    }

    if (!this.reporterConfigOptions.minimal) {
      if (this.reporterConfigOptions.start)
        test.start = this.updateStart(testResult.startTime)
      if (this.reporterConfigOptions.stop)
        test.stop = Math.floor(Date.now() / 1000)
      if (this.reporterConfigOptions.message)
        test.message = this.extractFailureDetails(testResult).message
      if (this.reporterConfigOptions.trace)
        test.trace = this.extractFailureDetails(testResult).trace
      if (this.reporterConfigOptions.rawStatus)
        test.rawStatus = testResult.status
      if (this.reporterConfigOptions.tags)
        test.tags = this.extractTagsFromTitle(testCase.title)
      if (
        this.reporterConfigOptions.type !== undefined ||
        (this.reporterConfigOptions.customType !== undefined &&
          this.reporterConfigOptions.customType !== '')
      )
        test.type =
          this.reporterConfigOptions.customType != null &&
          this.reporterConfigOptions.customType !== ''
            ? this.reporterConfigOptions.customType
            : 'e2e'
      if (this.reporterConfigOptions.filePath)
        test.filePath = testCase.location.file
      if (this.reporterConfigOptions.flake)
        test.flake = testResult.status === 'passed' && testResult.retry > 0
      if (this.reporterConfigOptions.retry) test.retry = testResult.retry
      if (this.reporterConfigOptions.screenshot)
        test.screenshot = this.extractScreenshotBase64(testResult)
      if (this.reporterConfigOptions.suite)
        test.suite = this.buildSuitePath(testCase)
      if (this.reporterConfigOptions.browser) {
        test.browser = `${this.extractMetadata(testResult).name} ${
          this.extractMetadata(testResult).version
        }`
      }
    }

    ctrfReport.results.tests.push(test)
  }

  mapPlaywrightStatusToCtrf(testStatus: string): CtrfTestState {
    switch (testStatus) {
      case 'passed':
        return 'passed'
      case 'failed':
      case 'timedOut':
      case 'interrupted':
        return 'failed'
      case 'skipped':
        return 'skipped'
      case 'pending':
        return 'pending'
      default:
        return 'other'
    }
  }

  extractMetadata(testResult: TestResult): any {
    const metadataAttachment = testResult.attachments.find(
      (attachment) => attachment.name === 'metadata.json'
    )
    if (
      metadataAttachment?.body !== null &&
      metadataAttachment?.body !== undefined
    ) {
      try {
        const metadataRaw = metadataAttachment.body.toString('utf-8')
        return JSON.parse(metadataRaw)
      } catch (e) {
        if (e instanceof Error) {
          console.error(`Error parsing browser metadata: ${e.message}`)
        } else {
          console.error('An unknown error occurred in parsing browser metadata')
        }
      }
    }
    return null
  }

  updateStart(startTime: Date): number {
    const date = new Date(startTime)
    const unixEpochTime = Math.floor(date.getTime() / 1000)
    return unixEpochTime
  }

  buildSuitePath(test: TestCase): string {
    const pathComponents = []
    let currentSuite: Suite | undefined = test.parent

    while (currentSuite !== undefined) {
      if (currentSuite.title !== '') {
        pathComponents.unshift(currentSuite.title)
      }
      currentSuite = currentSuite.parent
    }

    return pathComponents.join(' > ')
  }

  extractTagsFromTitle(title: string): string[] {
    const tagPattern = /@\w+/g
    const tags = title.match(tagPattern)
    return tags ?? []
  }

  extractScreenshotBase64(testResult: TestResult): string | undefined {
    const screenshotAttachment = testResult.attachments.find(
      (attachment) =>
        attachment.name === 'screenshot' &&
        (attachment.contentType === 'image/jpeg' ||
          attachment.contentType === 'image/png')
    )

    return screenshotAttachment?.body?.toString('base64')
  }

  extractFailureDetails(testResult: TestResult): Partial<CtrfTest> {
    if (testResult.status === 'failed' && testResult.error !== undefined) {
      const failureDetails: Partial<CtrfTest> = {}
      if (testResult.error.message !== undefined) {
        failureDetails.message = testResult.error.message
      }
      if (testResult.error.stack !== undefined) {
        failureDetails.trace = testResult.error.stack
      }
      return failureDetails
    }
    return {}
  }

  updateTotalsFromTestResult(
    testResult: TestResult,
    ctrfReport: CtrfReport
  ): void {
    ctrfReport.results.totals.tests++

    const ctrfStatus = this.mapPlaywrightStatusToCtrf(testResult.status)

    if (ctrfStatus in ctrfReport.results.totals) {
      ctrfReport.results.totals[ctrfStatus]++
    } else {
      ctrfReport.results.totals.other++
    }
  }

  writeReportToFile(data: CtrfReport): void {
    const filePath = path.join(
      this.reporterConfigOptions.outputDir,
      this.reporterConfigOptions.outputFile
    )
    const str = JSON.stringify(data, null, 2)
    try {
      fs.writeFileSync(filePath, str + '\n')
      console.log(
        `${this.reporterName}: successfully written ctrf json to %s`,
        this.reporterConfigOptions.outputFile
      )
    } catch (error) {
      console.error(`Error writing ctrf json report:, ${String(error)}`)
    }
  }
}

export default GenerateCtrfReport
