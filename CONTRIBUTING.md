# Contributing

First off, thank you for considering contributing to this project.

## Reporting Issues

Before submitting an issue, please check the issue tracker to ensure that the issue hasn't already been reported. If you find your issue already reported, you can subscribe to that issue to receive updates. If you have any additional information to add, please comment on the issue. If the issue is unnasigned and you'd like to contribute, assign the issue to yourself.

## How to Contribute

If you'd like to contribute, start by searching through the issues and pull requests to see whether someone else has raised a similar idea or question.

If you don't see your idea listed, and you think it fits into the goals of this project, do one of the following:

- If your contribution is minor, such as a typo fix, open a pull request.
- If your contribution is major, or you have not yet decided how to implement your idea, open an issue to discuss it. This allows other contributors to point out any potential flaws or to help you flesh out your idea.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. Write some code
3. Make sure your code lints.
4. Issue that pull request!

### Commit Messages

Write meaningful commit messages that provide insight into the changes made.

## Local Development

To set up the project for local development:

1. **Install dependencies**:

   ```bash
   npm ci
   ```

2. **Run linting checks**:

   ```bash
   npm run lint:check
   ```

3. **Run formatting checks**:

   ```bash
   npm run format:check
   ```

4. **Run tests**:

   ```bash
   npm test
   ```

5. **Build the package**:

   ```bash
   npm run build
   ```

Run the relevant checks before submitting a pull request and report their results.
CI publishes the existing reporter tests through GitHub Test Reporter. The
reference Node job maintains a `reporter-tests` PR comment, separately from the
conformance comment; both comments are overwritten on subsequent builds.

### Conformance tests

For reporter output changes, update the affected conformance fixtures and run:

```bash
npm run test:standard:conformance:unit
npx playwright install chromium
npm run test:standard:conformance:integration
```

`npm run test:standard:conformance` runs both levels even when unit fails.
The [suite guide](tests/standard/conformance/README.md) explains setup and file roles.
Unit tests use controlled native inputs; integration tests install the packed
reporter and run real Playwright with an independent native observer. They remain
separate from `npm test` and the original integration smoke.

Keep common family IDs stable, update `playwright.json` when capabilities change,
and provide positive evidence for supported properties. Unsupported optional
features are skipped with reasons; unrecorded broken behavior must fail.
Expected-failure entries in `tests/standard/conformance/expected-failures.mjs`
must link to a GitHub issue and match specific levels/samples. Keep checks running;
unexpected passes and changed failures must fail. Remove markers with the fix.
Check schema and written-specification implications, including valid omission and
conditional rules. Recommendations remain advisory. Do not change expectations
to match incorrect reporter output.

CI runs both conformance levels as separate steps in the existing integration
job on Node 22, 24 and 26. A unit failure does not prevent integration from running.
The job publishes CTRF results for both levels through GitHub Test Reporter, with
the built-in summary and folded suite table, grouped by level and check category. Node 24 also maintains one PR
comment tagged `reporter-conformance`, overwriting it on later runs. It describes
the reference runtime; check the full matrix for compatibility results. Fork PRs
keep build summaries/artifacts without posting a comment. Expected failures retain
explicit test-name labels and use Other with defect metadata rather than passed.
Unit/integration names and identities stay distinct; the conformance comment
contains contract families only. Shared checker controls use the same independent
fixtures and test IDs across reporters, run with `npm run test:standard:checker`,
and publish separately under `reporter-checker`. Reporter-specific fixture,
matcher and reporting controls belong in the reporter's own tests and
`reporter-tests` results. `npm run test:standard` runs all standard suites.
CTRF artifacts, conformance summaries and integration reports/logs are retained,
including on failure. The unit command uses the default and CTRF reporters from
`vitest.conformance.config.ts`; no additional Vitest JSON output is required.
In your PR, include commands and results and explain skips, expected failures and
warnings. Track defect details and fixes in GitHub issues rather than these docs.

### Original integration smoke

Run `npm run test:integration` to build and pack the reporter, install it into
an isolated temporary consumer, and run real Playwright tests. This command
needs npm registry access to install the exact Playwright and CTRF versions
declared in this repository. It does not publish a package or install browsers.

The fixture suite uses plain assertions and covers passing, failing, skipped,
expected-failure and retried tests. It runs in full, annotations-enabled and
minimal modes. A harness requires the expected failing runner exit code and
then validates the actual report files against CTRF specification 0.2.0, the
expected outcomes, retry history, timestamps, failure text, runtime metadata
and supported identities. The checker also has to reject deliberately
corrupted reports, including schema-valid semantic errors.

Reports and command logs are retained in `.integration-artifacts/`; temporary
consumer installations are removed. CI runs this check on Node 22, 24 and 26,
uploads diagnostics. Release-workflow behavior is unchanged by this test setup. Validation
scripts and fixtures are excluded from the published package and runtime.

Keep fixture expectations in `tests/integration/expectations.json` explicit.
When adding a scenario, preserve the distinction between final test outcomes
and prior attempts. Do not ignore unexpected runner failures or reuse output
from a previous run. Browser-specific behavior needs separate browser tests.

## Finding Bugs

If you find a bug, please report it in the issue tracker with a detailed description.

## Feature Requests

Feature requests are welcome. But take a moment to find out whether your idea fits with the scope and aims of the project. Please provide as much detail and context as possible.

## License

By contributing to this project, you agree that your contributions will be licensed under MIT.

## Acknowledgments

Your contributions are sincerely appreciated. We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

Thank you for your interest in contributing

## Contributing to the CTRF Specification

This repository contains an implementation of CTRF.

If you are interested in contributing to the **CTRF specification itself**
(including the schema or written standard), please refer to the
CTRF specification contribution guidelines:

https://github.com/ctrf-io/ctrf/blob/main/CONTRIBUTING.md

## TypeScript compiler tooling

The native TypeScript 7.0.2 compiler is installed through the exact
`@typescript/native` alias and provides `tsc` for compilation and type checks.
The `typescript` alias points to `@typescript/typescript6@6.0.2` so tools that
import the compiler API remain compatible. Keep both development dependencies.

Run `npm run build:check` to check source types with TypeScript 7, and
`npm run all` for the repository checks and build.
The tsup declaration build uses the TypeScript 6 API; its deprecation option
is scoped to `tsup.config.ts` rather than the native compiler configuration.
