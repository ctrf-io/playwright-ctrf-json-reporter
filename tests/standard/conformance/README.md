# Standard conformance

Conformance uses shared property and report/relationship checks at both unit and
integration levels, against the declared CTRF specification version. These are
coverage families, not an exhaustive set of cases. Existing reporter tests and
integration smoke are separate.

```sh
npm run test:standard:conformance:unit
npx playwright install chromium
npm run test:standard:conformance:integration
# Run both, even if unit fails:
npm run test:standard:conformance
```

Unit tests capture output from controlled native inputs; separate controls
test the checker. Integration installs the packed reporter in a temporary consumer
and runs real Playwright, including Chromium. It needs npm registry access and
the browser matching the pinned Playwright version. CI installs browser system
dependencies too. Missing setup fails the run.

Temporary consumers are cleaned automatically. Set `CTRF_STANDARD_ARTIFACTS` to an
absolute directory outside the checkout to retain integration reports and logs.
Use `PLAYWRIGHT_BROWSERS_PATH` for a separate browser installation.

Both suites generate schema-validated CTRF under `$CTRF_STANDARD_ARTIFACTS/reports`
(or `ctrf/reports` locally). CI publishes these through GitHub Test Reporter in the
integration job summary and retains CTRF artifacts. The reference Node job also
maintains one PR comment using the built-in summary and collapsed test table;
no custom template is needed. Fork PRs retain build summaries and artifacts with
read-only tokens. Unit results include checker controls. Expected failures use **Other**, explicit labels and defect metadata;
they are not counted as passed. Unit and integration identities remain distinct.

- `shared/catalogue.json`: common family IDs for this pilot; property paths are
  checked against the schema. It is a local snapshot pending shared distribution.
- `shared/checks.mjs`: schema and specification assertions.
- `playwright.json`: capabilities and reasons for unsupported entries.
- `expected.mjs` and native fixtures: independent Playwright expectations.

Unsupported optional features remain skipped with reasons. Supported fields need
positive evidence; all emitted fields undergo full-document validation. Mandatory
violations fail, recommendations warn, and missing fixture evidence cannot count
as a pass. Expected-failure entries in `expected-failures.mjs` link to GitHub issues
and match specific samples. They still execute and
are reported separately as expected failures; different errors or unexpected
passes fail CI. Remove the matching markers when fixing a defect. Expected
failures are not conformance passes.
Test tooling is excluded from the published package.
