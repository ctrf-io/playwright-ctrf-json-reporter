export interface CtrfReport {
  results: Results
}

export interface Results {
  tool: Tool
  totals: Totals
  tests: CtrfTest[]
}

export interface Totals {
  tests: number
  passed: number
  failed: number
  skipped: number
  pending: number
  timedOut: number
  interrupted: number
  other: number
  suites?: number
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
  browser?: string
  device?: string
  screenshot?: string
  parameters?: Record<string, any>
  steps?: Step[]
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
