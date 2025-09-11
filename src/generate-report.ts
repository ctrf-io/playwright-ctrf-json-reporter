import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

import {
  type Suite,
  type Reporter,
  type TestCase,
  type TestResult,
  type FullConfig,
  type TestStep,
} from '@playwright/test/reporter'

import {
  type CtrfTestState,
  type CtrfReport,
  type CtrfTest,
  type CtrfEnvironment,
  type CtrfAttachment,
  type CtrfTestAttempt,
} from '../types/ctrf'

interface ReporterConfigOptions {
  outputFile?: string
  outputDir?: string
  minimal?: boolean
  screenshot?: boolean
  annotations?: boolean
  testType?: string
  appName?: string | undefined
  appVersion?: string | undefined
  osPlatform?: string | undefined
  osRelease?: string | undefined
  osVersion?: string | undefined
  buildName?: string | undefined
  buildNumber?: string | undefined
  buildUrl?: string | undefined
  repositoryName?: string | undefined
  repositoryUrl?: string | undefined
  branchName?: string | undefined
  testEnvironment?: string | undefined
}

class GenerateCtrfReport implements Reporter {
  readonly ctrfReport: CtrfReport
  readonly ctrfEnvironment: CtrfEnvironment
  readonly reporterConfigOptions: ReporterConfigOptions
  readonly reporterName = 'playwright-ctrf-json-reporter'
  readonly defaultOutputFile = 'ctrf-report.json'
  readonly defaultOutputDir = 'ctrf'
  private suite: Suite | undefined
  private startTime: number | undefined

  constructor(config?: Partial<ReporterConfigOptions>) {
    this.reporterConfigOptions = {
      outputFile: config?.outputFile ?? this.defaultOutputFile,
      outputDir: config?.outputDir ?? this.defaultOutputDir,
      minimal: config?.minimal ?? false,
      screenshot: config?.screenshot ?? false,
      annotations: config?.annotations ?? false,
      testType: config?.testType ?? 'e2e',
      appName: config?.appName ?? undefined,
      appVersion: config?.appVersion ?? undefined,
      osPlatform: config?.osPlatform ?? undefined,
      osRelease: config?.osRelease ?? undefined,
      osVersion: config?.osVersion ?? undefined,
      buildName: config?.buildName ?? undefined,
      buildNumber: config?.buildNumber ?? undefined,
      buildUrl: config?.buildUrl ?? undefined,
      repositoryName: config?.repositoryName ?? undefined,
      repositoryUrl: config?.repositoryUrl ?? undefined,
      branchName: config?.branchName ?? undefined,
      testEnvironment: config?.testEnvironment ?? undefined,
    }

    this.ctrfReport = {
      reportFormat: 'CTRF',
      specVersion: '0.0.0',
      reportId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      generatedBy: 'playwright-ctrf-json-reporter',
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
          start: 0,
          stop: 0,
        },
        tests: [],
      },
    }

    this.ctrfEnvironment = {}
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite
    this.startTime = Date.now()
    this.ctrfReport.results.summary.start = this.startTime

    if (
      !fs.existsSync(
        this.reporterConfigOptions.outputDir ?? this.defaultOutputDir
      )
    ) {
      fs.mkdirSync(
        this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
        { recursive: true }
      )
    }

    this.setEnvironmentDetails(this.reporterConfigOptions)

    if (this.hasEnvironmentDetails(this.ctrfEnvironment)) {
      this.ctrfReport.results.environment = this.ctrfEnvironment
    }

    this.setFilename(
      this.reporterConfigOptions.outputFile ?? this.defaultOutputFile
    )
  }

  onEnd(): void {
    this.ctrfReport.results.summary.stop = Date.now()

    if (this.suite !== undefined) {
      if (this.suite.allTests().length > 0) {
        this.processSuite(this.suite)

        this.ctrfReport.results.summary.suites = this.countSuites(this.suite)
      }
    }
    this.writeReportToFile(this.ctrfReport)
  }

  printsToStdio(): boolean {
    return false
  }

  processSuite(suite: Suite): void {
    for (const test of suite.tests) {
      this.processTest(test)
    }

    for (const childSuite of suite.suites) {
      this.processSuite(childSuite)
    }
  }

  processTest(testCase: TestCase): void {
    if (testCase.results.length === 0) {
      return
    }
    const latestResult = testCase.results[testCase.results.length - 1]
    if (latestResult !== undefined) {
      this.updateCtrfTestResultsFromTestResult(
        testCase,
        latestResult,
        this.ctrfReport
      )
      this.updateSummaryFromTestResult(latestResult, this.ctrfReport)
    }
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

    if (this.reporterConfigOptions.minimal === false) {
      test.start = this.updateStart(testResult.startTime)
      test.stop = this.calculateStopTime(
        testResult.startTime,
        testResult.duration
      )
      test.message = this.extractFailureDetails(testResult).message
      test.trace = this.extractFailureDetails(testResult).trace
      test.snippet = this.extractFailureDetails(testResult).snippet
      test.rawStatus = testResult.status
      test.tags = testCase.tags
      test.type = this.reporterConfigOptions.testType ?? 'e2e'
      test.filePath = testCase.location.file
      test.retries = testResult.retry
      test.flaky = testResult.status === 'passed' && testResult.retry > 0
      test.steps = []
      if (testResult.steps.length > 0) {
        testResult.steps.forEach((step) => {
          this.processStep(test, step)
        })
      }
      if (this.reporterConfigOptions.screenshot === true) {
        test.screenshot = this.extractScreenshotBase64(testResult)
      }
      test.suite = this.buildSuitePath(testCase)
      if (
        this.extractMetadata(testResult)?.name !== undefined ||
        this.extractMetadata(testResult)?.version !== undefined
      )
        test.browser = `${this.extractMetadata(testResult)
          ?.name} ${this.extractMetadata(testResult)?.version}`
      test.attachments = this.filterValidAttachments(testResult.attachments)
      test.stdout = testResult.stdout.map((item) =>
        Buffer.isBuffer(item) ? item.toString() : String(item)
      )
      test.stderr = testResult.stderr.map((item) =>
        Buffer.isBuffer(item) ? item.toString() : String(item)
      )
      if (this.reporterConfigOptions.annotations !== undefined) {
        test.extra = { annotations: testCase.annotations }
      }

      if (testCase.results.length > 1) {
        const retryResults = testCase.results.slice(0, -1)
        test.retryAttempts = []

        for (const retryResult of retryResults) {
          const retryAttempt: CtrfTestAttempt = {
            status: this.mapPlaywrightStatusToCtrf(retryResult.status),
            duration: retryResult.duration,
            message: this.extractFailureDetails(retryResult).message,
            trace: this.extractFailureDetails(retryResult).trace,
            snippet: this.extractFailureDetails(retryResult).snippet,
          }
          test.retryAttempts.push(retryAttempt)
        }
      }
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
    if (reporterConfigOptions.appName !== undefined) {
      this.ctrfEnvironment.appName = reporterConfigOptions.appName
    }
    if (reporterConfigOptions.appVersion !== undefined) {
      this.ctrfEnvironment.appVersion = reporterConfigOptions.appVersion
    }
    if (reporterConfigOptions.osPlatform !== undefined) {
      this.ctrfEnvironment.osPlatform = reporterConfigOptions.osPlatform
    }
    if (reporterConfigOptions.osRelease !== undefined) {
      this.ctrfEnvironment.osRelease = reporterConfigOptions.osRelease
    }
    if (reporterConfigOptions.osVersion !== undefined) {
      this.ctrfEnvironment.osVersion = reporterConfigOptions.osVersion
    }
    if (reporterConfigOptions.buildName !== undefined) {
      this.ctrfEnvironment.buildName = reporterConfigOptions.buildName
    }
    if (reporterConfigOptions.buildNumber !== undefined) {
      this.ctrfEnvironment.buildNumber = reporterConfigOptions.buildNumber
    }
    if (reporterConfigOptions.buildUrl !== undefined) {
      this.ctrfEnvironment.buildUrl = reporterConfigOptions.buildUrl
    }
    if (reporterConfigOptions.repositoryName !== undefined) {
      this.ctrfEnvironment.repositoryName = reporterConfigOptions.repositoryName
    }
    if (reporterConfigOptions.repositoryUrl !== undefined) {
      this.ctrfEnvironment.repositoryUrl = reporterConfigOptions.repositoryUrl
    }
    if (reporterConfigOptions.branchName !== undefined) {
      this.ctrfEnvironment.branchName = reporterConfigOptions.branchName
    }
    if (reporterConfigOptions.testEnvironment !== undefined) {
      this.ctrfEnvironment.testEnvironment =
        reporterConfigOptions.testEnvironment
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

  calculateStopTime(startTime: Date, duration: number): number {
    const startDate = new Date(startTime)
    const stopDate = new Date(startDate.getTime() + duration)
    return Math.floor(stopDate.getTime() / 1000)
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
    if (
      (testResult.status === 'failed' ||
        testResult.status === 'timedOut' ||
        testResult.status === 'interrupted') &&
      testResult.error !== undefined
    ) {
      const failureDetails: Partial<CtrfTest> = {}
      if (testResult.error.message !== undefined) {
        failureDetails.message = testResult.error.message
      }
      if (testResult.error.stack !== undefined) {
        failureDetails.trace = testResult.error.stack
      }
      if (testResult.error.snippet !== undefined) {
        failureDetails.snippet = testResult.error.snippet
      }
      return failureDetails
    }
    return {}
  }

  countSuites(suite: Suite): number {
    let count = 0

    suite.suites.forEach((childSuite) => {
      count += this.countSuites(childSuite)
    })

    return count
  }

  writeReportToFile(data: CtrfReport): void {
    const filePath = path.join(
      this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
      this.reporterConfigOptions.outputFile ?? this.defaultOutputFile
    )
    const str = JSON.stringify(data, null, 2)
    try {
      fs.writeFileSync(filePath, str + '\n')
      console.log(
        `${this.reporterName}: successfully written ctrf json to %s/%s`,
        this.reporterConfigOptions.outputDir,
        this.reporterConfigOptions.outputFile
      )
    } catch (error) {
      console.error(`Error writing ctrf json report:, ${String(error)}`)
    }
  }

  processStep(test: CtrfTest, step: TestStep): void {
    if (step.category === 'test.step') {
      const stepStatus =
        step.error === undefined
          ? this.mapPlaywrightStatusToCtrf('passed')
          : this.mapPlaywrightStatusToCtrf('failed')
      const currentStep = {
        name: step.title,
        status: stepStatus,
      }
      test.steps?.push(currentStep)
    }

    const childSteps = step.steps

    if (childSteps.length > 0) {
      childSteps.forEach((cStep) => {
        this.processStep(test, cStep)
      })
    }
  }

  filterValidAttachments(
    attachments: TestResult['attachments']
  ): CtrfAttachment[] {
    return attachments
      .filter((attachment) => attachment.path !== undefined)
      .map((attachment) => ({
        name: attachment.name,
        contentType: attachment.contentType,
        path: attachment.path ?? '',
      }))
  }
}

export default GenerateCtrfReport
