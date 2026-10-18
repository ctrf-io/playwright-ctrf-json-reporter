import { runExpectedFailure } from "./shared/expected-failures.mjs";
import assert, { AssertionError } from "node:assert/strict";
import { checkEntry } from "./shared/checks.mjs";

const numericIssue = {
	issue: "invalid-build-number",
	reason: "Fractional and non-finite build numbers produce invalid output",
	followUp:
		"https://github.com/ctrf-io/playwright-ctrf-json-reporter/issues/117",
	samples: { unit: ["fractional-build-number", "nonfinite-build-number"] },
};

// Reporter-specific exceptions; the common catalogue/checker remains unchanged.
export const expectedFailures = {
	"conformance/property/results.environment.buildNumber": numericIssue,
	"conformance/report/single-json-object": numericIssue,
};

export function expectedFailure(entry, level) {
	const issue = expectedFailures[entry.id];
	return issue?.samples[level] ? issue : undefined;
}

function matchesKnownFailure(entry, sample, _issue, error) {
	if (!(error instanceof AssertionError)) return false;
	const value = sample.report.results.environment.buildNumber;
	if (value !== (sample.name === "fractional-build-number" ? 1.5 : null))
		return false;
	const detail =
		entry.kind === "property"
			? "results.environment.buildNumber: data must be integer"
			: "data/results/environment/buildNumber must be integer";
	return (
		error.message.split("\n")[0] === `${sample.name}: ${detail}` &&
		error.actual === false &&
		error.expected === true &&
		error.operator === "=="
	);
}

export function runConformance(entry, context, level, check = checkEntry) {
	return runExpectedFailure(
		entry,
		context,
		level,
		expectedFailure(entry, level),
		check,
		matchesKnownFailure,
	);
}
