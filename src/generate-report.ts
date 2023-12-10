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
  message: boolean
  trace: boolean
  rawStatus: boolean
  tags: boolean
  filePath: boolean
  flake: boolean
  retry: boolean
  screenshot: boolean
  suite: boolean
  type: boolean
  browser: boolean
  device: boolean
  customType?: string
}

type ReporterConfig = [string, ReporterConfigOptions?]

class GenerateCtrfReport implements Reporter {
  readonly ctrfReport: CtrfReport
  readonly defaultOptions: ReporterConfigOptions
  reporterConfigOptions: ReporterConfigOptions | undefined = undefined
  // readonly reporterName = "ctrf-json-reporter";
  readonly reporterName =
    '/Users/matthew/projects/personal/ctrf/playwright-ctrf-json-report/dist/index.js'

  readonly defaultOutputFile = 'ctrf-report.json'
  readonly defaultOutputDir = '.'
  filename = this.defaultOutputFile
  outputDir = this.defaultOutputDir

  constructor() {
    this.defaultOptions = {
      outputFile: this.defaultOutputFile,
      outputDir: this.defaultOutputDir,
      minimal: false,
      start: true,
      stop: true,
      message: true,
      trace: true,
      rawStatus: true,
      tags: true,
      filePath: true,
      flake: true,
      retry: true,
      screenshot: false,
      suite: true,
      type: true,
      browser: true,
      device: true,
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
    const providedOptions = this.getReporterConfigOptions(config)
    this.reporterConfigOptions = { ...this.defaultOptions, ...providedOptions }

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
    this.writeToFile(this.filename, this.ctrfReport)
  }

  getReporterConfigOptions(
    config: FullConfig
  ): ReporterConfigOptions | undefined {
    const reporterConfig = config.reporter.find(
      (r) => r[0] === this.reporterName
    ) as ReporterConfig | undefined

    if (reporterConfig === null || reporterConfig === undefined) {
      console.warn(
        `${this.reporterName} configuration was not found in the reporter config`
      )
      return undefined
    }

    return reporterConfig[1]
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

    if (!this.reporterConfigOptions?.minimal) {
      if (this.reporterConfigOptions?.start)
        test.start = this.updateStart(testResult.startTime)
      if (this.reporterConfigOptions?.stop)
        test.stop = Math.floor(Date.now() / 1000)
      if (this.reporterConfigOptions?.message)
        test.message = this.extractFailureDetails(testResult).message
      if (this.reporterConfigOptions?.message)
        test.message = this.extractFailureDetails(testResult).trace
      if (this.reporterConfigOptions?.rawStatus)
        test.rawStatus = testResult.status
      if (this.reporterConfigOptions?.tags)
        test.tags = this.extractTagsFromTitle(testCase.title)
      if (
        this.reporterConfigOptions?.type ||
        this.reporterConfigOptions?.customType
      )
        test.type = this.reporterConfigOptions?.customType || 'e2e'
      if (this.reporterConfigOptions?.filePath)
        test.filePath = testCase.location.file
      if (this.reporterConfigOptions?.flake)
        test.flake = testResult.status === 'passed' && testResult.retry > 0
      if (this.reporterConfigOptions?.retry) test.retry = testResult.retry
      if (this.reporterConfigOptions?.screenshot)
        test.screenshot = this.extractScreenshotBase64(testResult)
      if (this.reporterConfigOptions?.suite)
        test.suite = this.buildSuitePath(testCase)
      if (this.reporterConfigOptions?.browser) {
        test.browser = `${this.extractMetadata(testResult).name} ${this.extractMetadata(testResult).version
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
    if (metadataAttachment?.body) {
      try {
        const metadataRaw = metadataAttachment.body.toString('utf-8')
        return JSON.parse(metadataRaw)
      } catch (e) {
        console.error(`Error parsing browser metadata: ${e}`)
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

    const fileName = path.basename(test.location.file)

    while (currentSuite) {
      if (currentSuite.title) {
        pathComponents.unshift(currentSuite.title)
      }
      currentSuite = currentSuite.parent
    }

    return pathComponents.join(' > ')
  }

  extractTagsFromTitle(title: string): string[] {
    const tagPattern = /@\w+/g
    const tags = title.match(tagPattern)
    return tags || []
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

  writeToFile(filename: string, data: CtrfReport): void {
    const filePath = path.join(
      this.reporterConfigOptions?.outputDir || this.outputDir,
      this.filename
    )
    const str = JSON.stringify(data, null, 2)
    try {
      fs.writeFileSync(filePath, str + '\n')
      console.log(
        `${this.reporterName}: successfully written ctrf json to %s`,
        filename
      )
    } catch (error) {
      console.error(`Error writing ctrf json report:, ${String(error)}`)
    }
  }
}

export default GenerateCtrfReport
