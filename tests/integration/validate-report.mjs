import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateStrict } from "ctrf";

// This script is copied into the isolated consumer and never shipped in dist/.
const [reportPath, expectationsPath, scenarioName, playwrightVersion] =
	process.argv.slice(2);
const expectations = JSON.parse(readFileSync(expectationsPath, "utf8"));
const scenario = expectations.scenarios.find(
	(item) => item.name === scenarioName,
);
assert.ok(scenario, `Unknown scenario: ${scenarioName}`);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
validateStrict(report, { specVersion: expectations.specVersion });
assert.equal(report.specVersion, expectations.specVersion);
assert.equal(report.results.tool.name, "playwright");
assert.equal(report.results.tool.version, playwrightVersion);
assert.equal(report.runId, scenario.options.runId);
assert.equal(
	report.results.environment?.buildNumber,
	scenario.options.buildNumber,
);
assert.equal(report.results.environment?.shardId, scenario.options.shardId);
assert.equal(
	report.results.extra?.errors,
	undefined,
	"Unexpected global runner error",
);

const { summary, tests } = report.results;
for (const [field, expected] of Object.entries(expectations.summary)) {
	assert.equal(summary[field], expected, `summary.${field}`);
}
assert.equal(tests.length, expectations.summary.tests);
assert.deepEqual(
	tests.map((test) => test.name).sort(),
	Object.keys(expectations.cases).sort(),
);
for (const status of ["passed", "failed", "skipped", "pending", "other"]) {
	assert.equal(
		summary[status],
		tests.filter((test) => test.status === status).length,
	);
}
assert.ok(
	summary.start > 1_000_000_000_000,
	"Summary start must be epoch milliseconds",
);
assert.ok(summary.stop >= summary.start);
assert.equal(summary.duration, summary.stop - summary.start);
assert.ok(summary.suites > 0, "Named fixture suites must be counted");

const testIds = new Set();
const executionIds = new Set();
const attemptIds = new Set();
const attachmentIds = new Set();
function unique(value, seen, field) {
	assert.ok(typeof value === "string" && value.length > 0, `Missing ${field}`);
	assert.ok(!seen.has(value), `Duplicate ${field}: ${value}`);
	seen.add(value);
}

function cleanErrorText(result) {
	for (const field of ["message", "trace", "snippet"]) {
		if (result[field] !== undefined) {
			assert.ok(
				!/[\u001b\u009b]/u.test(result[field]),
				`ANSI escape in ${field}`,
			);
		}
	}
}

function checkAttachments(result) {
	for (const attachment of result.attachments ?? []) {
		unique(attachment.attachmentId, attachmentIds, "attachmentId");
		assert.notEqual(
			attachment.contentType,
			"application/vnd.ctrf.message+json",
		);
		assert.ok(attachment.path.length > 0);
	}
}

for (const test of tests) {
	const expected = expectations.cases[test.name];
	assert.equal(test.status, expected.status, test.name);
	unique(test.testId, testIds, "testId");
	unique(test.executionId, executionIds, "executionId");
	unique(test.attemptId, attemptIds, "attemptId");
	if (scenario.options.minimal) {
		for (const field of [
			"suite",
			"start",
			"stop",
			"rawStatus",
			"retries",
			"retryAttempts",
			"attachments",
			"extra",
			"message",
			"trace",
			"snippet",
		]) {
			assert.ok(
				!(field in test),
				`Minimal report unexpectedly includes ${field}`,
			);
		}
		continue;
	}

	assert.equal(test.rawStatus, expected.rawStatus);
	assert.equal(test.retries, expected.retries);
	assert.equal(test.flaky, test.name === "passes on retry");
	assert.deepEqual(test.suite.slice(-2), ["outcomes.spec.js", "integration"]);
	assert.ok(test.filePath.endsWith("outcomes.spec.js"));
	assert.ok(
		test.start > 1_000_000_000_000,
		"Test start must be epoch milliseconds",
	);
	assert.equal(test.stop, test.start + test.duration);
	cleanErrorText(test);
	checkAttachments(test);
	assert.equal(test.retryAttempts?.length ?? 0, expected.retries);
	for (const [index, attempt] of (test.retryAttempts ?? []).entries()) {
		assert.equal(attempt.attempt, index + 1);
		assert.equal(attempt.status, "failed");
		unique(attempt.attemptId, attemptIds, "attemptId");
		assert.ok(attempt.message?.length > 0, "Missing retry failure message");
		cleanErrorText(attempt);
		checkAttachments(attempt);
	}
	if (scenario.options.annotations) {
		assert.ok(Array.isArray(test.extra?.annotations));
	} else {
		assert.equal(test.extra?.annotations, undefined);
	}
}

if (!scenario.options.minimal) {
	const byName = Object.fromEntries(tests.map((test) => [test.name, test]));
	assert.ok(byName.fails.message?.length > 0);
	assert.ok(byName.fails.trace?.length > 0);
	assert.ok(byName.fails.snippet?.length > 0);
	assert.deepEqual(byName.passes.extra.smoke, { first: true, second: true });
	assert.deepEqual(byName.passes.extra.values, [1, 2]);
	assert.equal(byName.passes.attachments.length, 1);
	assert.equal(byName["passes on retry"].attachments.length, 1);
	assert.equal(
		byName["passes on retry"].retryAttempts[0].attachments.filter(
			(attachment) => attachment.name === "retry evidence",
		).length,
		1,
	);
	if (scenario.options.annotations) {
		assert.ok(
			byName.passes.extra.annotations.some(
				(item) => item.type === "issue" && item.description === "smoke",
			),
		);
	}
}
console.log(
	`Validated ${scenarioName}: ${tests.length} real Playwright results`,
);
