export interface CtrfReport {
  results: Results
}

export interface Results {
  tool: Tool
  summary: Summary
  tests: CtrfTest[]
  environment?: CtrfEnvironment
}

export interface Summary {
  tests: number
  passed: number
  failed: number
  skipped: number
  pending: number
  other: number
  suites?: number
  start: number
  stop: number
}

export interface CtrfTest {
  name: string
  status: CtrfTestState
  duration: number
  start?: number
  stop?: number
  suite?: string
  message?: string
  trace?: string
  rawStatus?: string
  tags?: string[]
  type?: string
  filePath?: string
  retry?: number
  flake?: boolean
  attempts?: CtrfTest[]
  browser?: string
  device?: string
  screenshot?: string
  parameters?: Record<string, any>
  steps?: Step[]
  extras?: Record<string, any>
}

export interface CtrfEnvironment {
  appName?: string
  appVersion?: string
  osPlatform?: string
  osRelease?: string
  osVersion?: string
  buildName?: string
  buildNumber?: string
}

export interface Tool {
  name: string
  version?: string
}

export interface Step {
  name: string
  status: CtrfTestState
}

export type CtrfTestState =
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'pending'
  | 'other'
