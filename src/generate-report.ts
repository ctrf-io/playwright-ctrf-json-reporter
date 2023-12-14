import * as fs from 'fs'
import * as path from 'path'

import {
  type Suite,
  type FullConfig,
  type Reporter,
  type TestCase,
  type TestResult,
} from '@playwright/test/reporter'

import {
  type CtrfTestState,
  type CtrfReport,
  type CtrfTest,
  type CtrfEnvironment,
} from '../types/ctrf'

interface ReporterConfigOptions {
  outputFile: string
  outputDir: string
  minimal: boolean
  screenshot: boolean
  testType?: string
  appName?: string
  appVersion?: string
  osPlatform?: string
  osRelease?: string
  osVersion?: string
  buildName?: string
  buildNumber?: string
}

type ReporterConfig = [string, ReporterConfigOptions?]

class GenerateCtrfReport implements Reporter {
  readonly ctrfReport: CtrfReport
  readonly ctrfEnvironment: CtrfEnvironment
  reporterConfigOptions: ReporterConfigOptions
  // readonly reporterName = 'ctrf-json-reporter'
  readonly reporterName =
    '/Users/matthew/projects/personal/ctrf/playwright-ctrf-json-reporter/dist/index.js'

  readonly defaultOutputFile = 'ctrf-report.json'
  readonly defaultOutputDir = '.'

  constructor() {
    this.reporterConfigOptions = {
      outputFile: this.defaultOutputFile,
      outputDir: this.defaultOutputDir,
      minimal: false,
      screenshot: false,
    }

    this.ctrfReport = {
      results: {
        tool: {
          name: 'playwright',
        },
        summary: {
          tests: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          other: 0,
        },
        tests: [],
      },
    }

    this.ctrfEnvironment = {}
  }

  onBegin(config: FullConfig): void {
    this.ctrfReport.results.summary.start = Date.now()
    this.reporterConfigOptions = this.getReporterConfigOptions(config)

    if (!fs.existsSync(this.reporterConfigOptions.outputDir)) {
      fs.mkdirSync(this.reporterConfigOptions.outputDir, { recursive: true })
    }

    this.setEnvironmentDetails(this.reporterConfigOptions)

    if (this.hasEnvironmentDetails(this.ctrfEnvironment)) {
      this.ctrfReport.results.environment = this.ctrfEnvironment
    }
    this.setFilename(this.reporterConfigOptions.outputFile)
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.updateCtrfTestResultsFromTestResult(test, result, this.ctrfReport)
    this.updateSummaryFromTestResult(result, this.ctrfReport)
  }

  onEnd(): void {
    this.ctrfReport.results.summary.stop = Date.now()
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
      this.reporterConfigOptions.outputFile = filename
    } else {
      this.reporterConfigOptions.outputFile = `${filename}.json`
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
      test.start = this.updateStart(testResult.startTime)
      test.stop = Math.floor(Date.now() / 1000)
      test.message = this.extractFailureDetails(testResult).message
      test.trace = this.extractFailureDetails(testResult).trace
      test.rawStatus = testResult.status
      test.tags = this.extractTagsFromTitle(testCase.title)
      test.type =
        this.reporterConfigOptions.testType != null &&
          this.reporterConfigOptions.testType !== ''
          ? this.reporterConfigOptions.testType
          : 'e2e'
      test.filePath = testCase.location.file
      test.retry = testResult.retry
      test.flake = testResult.status === 'passed' && testResult.retry > 0
      if (this.reporterConfigOptions.screenshot) {
        test.screenshot = this.extractScreenshotBase64(testResult)
      }
      test.suite = this.buildSuitePath(testCase)
      test.browser = `${this.extractMetadata(testResult)
        ?.name} ${this.extractMetadata(testResult)?.version}`
    }

    ctrfReport.results.tests.push(test)
  }

  updateSummaryFromTestResult(
    testResult: TestResult,
    ctrfReport: CtrfReport
  ): void {
    ctrfReport.results.summary.tests++

    const ctrfStatus = this.mapPlaywrightStatusToCtrf(testResult.status)

    if (ctrfStatus in ctrfReport.results.summary) {
      ctrfReport.results.summary[ctrfStatus]++
    } else {
      ctrfReport.results.summary.other++
    }
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

  setEnvironmentDetails(reporterConfigOptions: ReporterConfigOptions): void {
    if (reporterConfigOptions.appName != null) {
      this.ctrfEnvironment.appName = reporterConfigOptions.appName
    }
    if (reporterConfigOptions.appVersion != null) {
      this.ctrfEnvironment.appVersion = reporterConfigOptions.appVersion
    }
    if (reporterConfigOptions.osPlatform != null) {
      this.ctrfEnvironment.osPlatform = reporterConfigOptions.osPlatform
    }
    if (reporterConfigOptions.osRelease != null) {
      this.ctrfEnvironment.osRelease = reporterConfigOptions.osRelease
    }
    if (reporterConfigOptions.osVersion != null) {
      this.ctrfEnvironment.osVersion = reporterConfigOptions.osVersion
    }
    if (reporterConfigOptions.buildName != null) {
      this.ctrfEnvironment.buildName = reporterConfigOptions.buildName
    }
    if (reporterConfigOptions.buildNumber != null) {
      this.ctrfEnvironment.buildNumber = reporterConfigOptions.buildNumber
    }
  }

  hasEnvironmentDetails(environment: CtrfEnvironment): boolean {
    return Object.keys(environment).length > 0
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
