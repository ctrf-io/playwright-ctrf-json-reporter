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

- `shared/catalogue.json`: common family IDs for this pilot; property paths are
  checked against the schema. It is a local snapshot pending shared distribution.
- `shared/checks.mjs`: schema and specification assertions.
- `playwright.json`: capabilities and reasons for unsupported entries.
- `expected.mjs` and native fixtures: independent Playwright expectations.

Unsupported optional features remain skipped with reasons. Supported fields need
positive evidence; all emitted fields undergo full-document validation. Mandatory
violations fail, recommendations warn, and missing fixture evidence cannot count
as a pass. Keep known defects failing rather than weakening checks or capabilities.
Test tooling is excluded from the published package.
