# Standard reporter conformance pilot

This test-only pilot keeps existing reporter tests separate and leaves reporter
runtime behavior unchanged. It uses CTRF 0.2.0, with **185 stable family IDs**:
165 expanded property paths and twenty document/relationship rules. Tests inspect
reporter-produced serialized output; they do not duplicate the validator's full
invalid-input corpus or require every optional property to be implemented.

## Commands

```sh
npm run test:standard:conformance:unit
npm run test:standard:conformance:integration
npm run test:standard:conformance
```

The combined command runs both levels even if unit tests fail, and returns nonzero
if either level fails. `test:standard:unit`, `test:standard:integration` and
`test:standard` are aliases for the implemented conformance pilot. Packaging,
configuration, reliability and compatibility suites are not implemented by these
aliases. `npm test` and the original integration smoke remain separate.

Unit tests register all 185 families through Vitest. Ten additional checker
controls verify registration, valid controls, independent corruptions, actual
extension ownership and manifest honesty. They are reported separately from the
185 reporter-conformance entries. Controlled native inputs cover full/minimal
output, independent runs, shards, diagnostics, retries, optional evidence and
invalid numeric configuration. Schema-valid unexpected-pass mappings can still
fail the independently expected status/counter assertions.

Integration builds and packs the candidate, installs that tarball and exact
framework/runtime dependencies in a fresh temporary consumer, then executes real
Playwright. A separate native observer captures source test/attempt data, avoiding
an oracle derived from the CTRF output under test. Twelve scenario groups use
fourteen runner invocations: full, annotations, minimal, pass-only, skip-only,
empty, lifecycle faults (including global setup), multiple retries, workers,
coordinated shards (two invocations), browser evidence and configured fields.
Every runner exit is checked independently. Fresh output is required for each
invocation; stale files cannot satisfy a scenario.

The browser scenario requires the Chromium revision matching the pinned
Playwright version. Install it explicitly if needed:

```sh
npx playwright install chromium
```

Use `PLAYWRIGHT_BROWSERS_PATH` for a separate installation. Missing browser/setup
is an execution failure, never an unsupported-capability skip. Registry access is
needed for the isolated package installation. Temporary consumers, their cache
and reports are cleaned on success and failure. Set `CTRF_STANDARD_ARTIFACTS` to
an explicit absolute output directory to retain logs, native/source expectations,
serialized reports, TAP results and an integration summary. Keep generated output
outside the source tree; it may contain paths and diagnostics.

## Shared contract and adapter boundary

- `shared/catalogue.json` is the versioned, language-neutral list of IDs. Its
  property expansion is checked against public `ctrf.getSchema('0.2.0')`.
- `shared/checks.mjs` contains reusable schema/property/relationship assertions.
  It imports no Playwright reporter implementation or private workspace files.
  Ajv and formats are exact direct development dependencies, outside the bundle.
- `playwright.json` declares every supported or unsupported property/rule with a
  reason. All 185 entries register at each level. Unsupported entries are skipped;
  supported properties must have positive fixture evidence. An emitted property
  never escapes whole-document validation, including unexpected optional fields.
- `expected.mjs` and native fixtures supply framework-specific expected values.
  Preserve this boundary when a second reporter proves the shared design.

Schema errors and mandatory semantic errors fail. Recommendations are collected
and reported separately as warnings. Missing contextual fixture evidence must
fail or be explicitly TODO, not become a recommendation pass. IDs are scoped:
test IDs may repeat across executions, attempt IDs are checked within execution,
and attachment IDs within their parent. Opaque IDs need not be UUIDs unless the
schema specifically requires it. Timing uses independent native values/run
windows, not a universal epoch cutoff or an assumption of serial execution.

The pilot currently declares 101 applicable and 84 unsupported families; these
are capability declarations, not a promise that 101 tests pass. Preserve exposed
defects as failing tests while reviewing them. Do not weaken assertions, add
blanket expected failures or change supported features to unsupported to obtain
a green run. Fixtures and tooling are excluded from published package contents.
