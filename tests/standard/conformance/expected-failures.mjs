import assert, { AssertionError } from "node:assert/strict";
import { checkEntry, valuesAt } from "./shared/checks.mjs";

const unitSamples = [
	"full",
	"repeated",
	"minimal",
	"shard-one",
	"shard-two",
	"fractional-build-number",
	"nonfinite-build-number",
];
const mappingIssue = {
	issue: "unexpected-pass",
	reason: "Playwright unexpected pass is normalized to passed",
	followUp:
		"https://github.com/ctrf-io/playwright-ctrf-json-reporter/issues/116",
	samples: { unit: unitSamples, integration: ["timeout-and-hooks"] },
};
const numericIssue = {
	issue: "invalid-build-number",
	reason: "Fractional and non-finite build numbers produce invalid output",
	followUp:
		"https://github.com/ctrf-io/playwright-ctrf-json-reporter/issues/117",
	samples: { unit: ["fractional-build-number", "nonfinite-build-number"] },
};

// Reporter-specific exceptions; the common catalogue/checker remains unchanged.
export const expectedFailures = {
	"conformance/property/results.summary.passed": mappingIssue,
	"conformance/property/results.summary.failed": mappingIssue,
	"conformance/property/results.tests[].status": mappingIssue,
	"conformance/property/results.environment.buildNumber": numericIssue,
	"conformance/report/single-json-object": numericIssue,
};

export function expectedFailure(entry, level) {
	const issue = expectedFailures[entry.id];
	return issue?.samples[level] ? issue : undefined;
}

function matchesKnownFailure(entry, sample, issue, error) {
	if (!(error instanceof AssertionError)) return false;
	if (issue.issue === "unexpected-pass") {
		if (error.operator !== "deepStrictEqual") return false;
		if (
			!error.message.startsWith(
				`${sample.name}: source mapping ${entry.path}\n`,
			)
		)
			return false;
		const source = sample.expected.results.tests;
		const index = source.findIndex((test) => test.name === "unexpected pass");
		assert.ok(
			index >= 0 && source[index].status === "failed",
			"Missing native unexpected-pass evidence",
		);
		const expected = valuesAt(sample.expected, entry.path);
		let knownActual;
		if (entry.path === "results.tests[].status") {
			knownActual = [...expected];
			knownActual[index] = "passed";
		} else {
			knownActual = [expected[0] + (entry.path.endsWith(".passed") ? 1 : -1)];
		}
		try {
			assert.deepEqual(error.expected, expected);
			assert.deepEqual(error.actual, knownActual);
			return true;
		} catch {
			return false;
		}
	}
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
	const issue = expectedFailure(entry, level);
	if (!issue) return check(entry, context);
	const expectedSamples = new Set(issue.samples[level]);
	for (const name of expectedSamples)
		assert.equal(
			context.samples.filter((sample) => sample.name === name).length,
			1,
			`Expected-failure fixture missing or duplicated: ${name}`,
		);
	// Check every sample, including those after the original first failure.
	for (const sample of context.samples) {
		const parentPath = entry.path?.split(".").slice(0, -1).join(".");
		const hasParent =
			!parentPath || valuesAt(sample.report, parentPath).length > 0;
		// Optional absence in other modes is legitimate. The required known-bug
		// samples below still have to emit and reproduce their exact violation.
		if (
			entry.kind === "property" &&
			(!entry.required || !hasParent) &&
			!expectedSamples.has(sample.name) &&
			valuesAt(sample.report, entry.path).length === 0
		)
			continue;
		let failure;
		try {
			check(entry, { ...context, samples: [sample] });
		} catch (error) {
			failure = error;
		}
		if (!expectedSamples.has(sample.name)) {
			if (failure) throw failure;
			continue;
		}
		assert.ok(
			failure,
			`Unexpected pass: ${entry.id} / ${sample.name}; review and remove the expected-failure marker`,
		);
		if (!matchesKnownFailure(entry, sample, issue, failure)) throw failure;
	}
	return {
		id: entry.id,
		level,
		samples: [...expectedSamples],
		issue: issue.issue,
		reason: issue.reason,
		followUp: issue.followUp,
	};
}
