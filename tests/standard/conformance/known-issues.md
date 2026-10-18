# Known conformance defects

These reporter defects remain unfixed. `expected-failures.mjs` records their
exact tests, levels and samples. The checks still execute; new failures and
unexpected passes fail CI. Expected failures do not establish conformance.

## Unexpected pass

A Playwright test marked as an expected failure that passes unexpectedly is
reported as passed. Native Playwright considers its outcome unexpected.
This affects final status and the source-based passed/failed summary checks at
both levels. Follow-up: correct outcome normalization and verify expected failures,
unexpected passes and retries before removing the matching markers.

## Invalid build number

Fractional build numbers remain fractional, while non-finite values serialize to
null. Both violate the integer schema. This affects the property and complete
serialized-document checks in unit fixtures. Follow-up: agree rejection or omission
of invalid numeric configuration, preserve zero, and remove markers after both
invalid-input scenarios pass. Integration has no exception for this defect.
