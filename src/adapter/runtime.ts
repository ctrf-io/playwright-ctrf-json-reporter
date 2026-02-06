/**
 * CTRF Runtime API for Playwright
 *
 * Enables enriching CTRF test reports with custom metadata at runtime.
 * Metadata is collected via Playwright's native attachment mechanism and
 * consolidated by the reporter into the test's `extra` field.
 *
 * ## Usage
 *
 * ```ts
 * import { ctrf } from 'playwright-ctrf-json-reporter'
 *
 * test('checkout flow', async ({ page }) => {
 *   ctrf.extra({ owner: 'checkout-team', priority: 'P1' })
 *   // ... test code
 *   ctrf.extra({ customMetric: calculateValue() })
 * })
 * ```
 *
 * ## API
 *
 * - `ctrf.extra(data)` - Attach key-value metadata to the current test
 *
 * ## Behavior
 *
 * - Call multiple times; all data is collected and merged
 * - Works from any function in the call stack during test execution
 * - Silently ignored when called outside test context
 * - Deep merge: arrays concatenate, objects merge recursively, primitives overwrite
 */

import { test } from '@playwright/test'

/**
 * Content type used to identify CTRF runtime messages in attachments.
 * The reporter will look for attachments with this content type.
 */
export const CTRF_RUNTIME_MESSAGE_CONTENT_TYPE =
  'application/vnd.ctrf.message+json'

/**
 * Runtime message types
 */
export type CtrfRuntimeMessageType = 'metadata'

/**
 * A runtime message sent from test code to the reporter
 */
export interface CtrfRuntimeMessage {
  type: CtrfRuntimeMessageType
  data: Record<string, unknown>
}

/**
 * Internal interface for transporting metadata to the reporter.
 * Different test frameworks would implement this differently.
 */
interface MetadataTransport {
  send: (payload: CtrfRuntimeMessage) => Promise<void>
}

/**
 * Silent fallback when no test is active - prevents errors in setup/teardown code.
 */
const nullTransport: MetadataTransport = {
  send: async () => {
    /* intentionally empty */
  },
}

/**
 * Attaches metadata payloads to the current Playwright test as hidden attachments.
 * The reporter extracts these by content type during report generation.
 */
function createPlaywrightTransport(): MetadataTransport {
  let sequence = 0

  return {
    async send(payload: CtrfRuntimeMessage): Promise<void> {
      const tag = `__ctrf_${++sequence}_${Date.now()}`
      const data = JSON.stringify(payload)

      await test.info().attach(tag, {
        contentType: CTRF_RUNTIME_MESSAGE_CONTENT_TYPE,
        body: Buffer.from(data),
      })
    },
  }
}

const activeTransport = createPlaywrightTransport()

/**
 * Resolves the active transport, or a null transport if outside a test.
 */
const resolveTransport = (): MetadataTransport => {
  try {
    test.info()
    return activeTransport
  } catch {
    // Outside test context
  }
  return nullTransport
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Public API
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Attach custom metadata to the current test.
 *
 * @param data - Key-value pairs to include in the CTRF report's `extra` field
 * @returns Promise (can be ignored; completes when attachment is written)
 *
 * @remarks
 * - **Arrays**: Concatenated across calls (duplicates allowed)
 * - **Objects**: Deep merged (nested keys preserved)
 * - **Primitives**: Later calls overwrite earlier ones
 * - Safe to call from helper functions - binds to the active test automatically
 * - No-op outside test context (e.g., in global setup)
 *
 * @example
 * // Arrays concatenate
 * ctrf.extra({ tags: ['smoke'] })
 * ctrf.extra({ tags: ['e2e'] })
 * // → { tags: ['smoke', 'e2e'] }
 *
 * // Objects merge deeply
 * ctrf.extra({ build: { id: 'abc' } })
 * ctrf.extra({ build: { url: 'https://...' } })
 * // → { build: { id: 'abc', url: 'https://...' } }
 *
 * // Primitives overwrite
 * ctrf.extra({ owner: 'platform-team' })
 * ctrf.extra({ owner: 'checkout-team' })
 * // → { owner: 'checkout-team' }
 */
export async function extra(data: Record<string, unknown>): Promise<void> {
  await resolveTransport().send({ type: 'metadata', data })
}

/** CTRF runtime API namespace */
export const ctrf = { extra } as const
