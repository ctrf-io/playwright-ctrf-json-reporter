export interface CtrfReport {
  results: Results
}

export interface Results {
  tool: Tool
  totals: Totals
  tests: CtrfTest[]
}

export interface Totals {
  suites?: number
  tests: number
  passed: number
  failed: number
  skipped: number
  pending: number
  timedOut: number
  interrupted: number
  other: number
}

export interface CtrfTest {
  name: string
  duration: number
  status: CtrfTestState
  start?: number
  stop?: number
  message?: string
  trace?: string
  rawStatus?: string
  environment?: string
  tags?: string[]
  type?: string
  suite?: string
  parameters?: Record<string, any>
  steps?: Step[]
  screenshot?: string
  filePath?: string
  flake?: boolean
  retry?: number
  browser?: string
  device?: string
  extras?: Record<string, any>
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
